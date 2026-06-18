import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile // ضفنا دي عشان نحفظ الاسم
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; // ضفنا دول عشان نرفع الاسم لليدربورد

import { auth, db } from "../firebase"; // ضفنا db هنا
import { ChevronRight } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: () => void;
  onBack: () => void; // ضفنا خاصية الرجوع هنا
}

export default function AuthScreen({
  onLoginSuccess,
  onBack, // استلمناها هنا
}: AuthScreenProps) {
  const [isLoginMode, setIsLoginMode] = useState(true); // عشان نبدل بين تسجيل الدخول وإنشاء حساب
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("يجب إدخال الاسم الأول والأخير ⚠️");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      
      // حفظ الاسم في بروفايل اللاعب على فايربيس
      await updateProfile(userCredential.user, {
        displayName: fullName
      });

      // حفظ بيانات المستخدم واسمه في Firestore فوراً عشان الليدربورد يقراها
      await setDoc(doc(db, "users", userCredential.user.uid), {
        displayName: fullName,
        email: email,
        totalScore: 0,
        unlockedLevels: ["level_1"],
        stars: {},
        scores: {}
      });

      setSuccessMsg("تم إنشاء الحساب بنجاح ✅");
      // خليناها تستنى ثانية عشان اللاعب يلحق يشوف رسالة النجاح قبل ما تدخله على اللعبة
      setTimeout(() => {
        onLoginSuccess();
      }, 1000);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg("البريد الإلكتروني ده مستخدم قبل كده.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMsg("كلمة المرور ضعيفة جداً، لازم تكون 6 حروف على الأقل.");
      } else {
        setErrorMsg("حصل خطأ في إنشاء الحساب.");
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMsg("تم تسجيل الدخول ✅");
      onLoginSuccess();
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setErrorMsg("كلمة المرور أو البريد الإلكتروني غير صحيح ❌");
      } else {
        setErrorMsg("حصلت مشكلة في تسجيل الدخول. حاول تاني.");
      }
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    
    if (!email) {
      setErrorMsg("اكتب البريد الإلكتروني في الخانة الأول عشان نبعتلك الرابط ⚠️");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("بعتنالك رابط على الإيميل عشان تغير كلمة المرور! ✅ (راجع الـ Spam)");
    } catch (error: any) {
      setErrorMsg("تأكد من كتابة البريد الإلكتروني بشكل صحيح.");
    }
  };

  return (
    <div
      dir="rtl"
      className="relative w-full h-full flex items-center justify-center bg-slate-900/50"
    >
      {/* ── زرار الرجوع ── */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-white text-blue-900 shadow-lg hover:scale-105 active:scale-95 transition-all"
      >
        <ChevronRight size={28} />
      </button>

      <form 
        onSubmit={isLoginMode ? handleLogin : handleRegister}
        className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col gap-3 w-[90%] max-w-[360px] border-4 border-blue-500"
      >
        <h1 className="text-3xl font-black text-center mb-4 text-blue-900">
          {isLoginMode ? "تسجيل الدخول" : "حساب جديد"}
        </h1>

        {!isLoginMode && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="الاسم الأول"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="border-2 border-slate-200 p-2 rounded-xl w-1/2 focus:border-blue-500 outline-none font-bold"
            />
            <input
              type="text"
              placeholder="الاسم الأخير"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="border-2 border-slate-200 p-2 rounded-xl w-1/2 focus:border-blue-500 outline-none font-bold"
            />
          </div>
        )}

        <input
          type="email"
          placeholder="البريد الإلكتروني"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-2 border-slate-200 p-2 rounded-xl text-left focus:border-blue-500 outline-none font-bold"
          dir="ltr"
          autoComplete="username"
        />

        <input
          type="password"
          placeholder="كلمة المرور"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-2 border-slate-200 p-2 rounded-xl text-left focus:border-blue-500 outline-none font-bold"
          dir="ltr"
          autoComplete={isLoginMode ? "current-password" : "new-password"}
        />

        {errorMsg && <p className="text-red-600 text-sm text-center font-bold">{errorMsg}</p>}
        {successMsg && <p className="text-green-600 text-sm text-center font-bold">{successMsg}</p>}

        {isLoginMode && (
          <button
            onClick={handleResetPassword}
            className="text-blue-600 text-sm text-right hover:underline bg-transparent border-none cursor-pointer w-fit font-bold"
            type="button"
          >
            نسيت كلمة المرور؟
          </button>
        )}

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-black text-lg mt-2 transition-colors shadow-lg"
        >
          {isLoginMode ? "دخول" : "إنشاء حساب"}
        </button>

        <div className="text-center mt-2 border-t pt-4">
          <span className="text-slate-500 font-bold text-sm">
            {isLoginMode ? "لست مسجلاً بعد؟ " : "لديك حساب بالفعل؟ "}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className="text-orange-500 hover:text-orange-600 font-black text-sm underline"
          >
            {isLoginMode ? "أنشئ حساباً جديداً" : "سجل دخولك الآن"}
          </button>
        </div>
      </form>
    </div>
  );
}