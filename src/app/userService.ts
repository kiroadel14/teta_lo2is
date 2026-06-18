import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

// إنشاء مستخدم أول مرة
export async function createUserData(uid: string, email: string) {
  await setDoc(doc(db, "users", uid), {
    email,
    unlockedLevels: ["level_1"],
    stars: {},
    currentLevel: "level_1",
  });
}

// تحميل بيانات المستخدم
export async function getUserData(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// تحديث النجوم + الفتح
export async function updateLevelProgress(
  uid: string,
  levelId: string,
  stars: number,
  nextLevel?: string
) {
  const ref = doc(db, "users", uid);

  const snap = await getDoc(ref);
  const data = snap.data();

  const updatedStars = {
    ...(data?.stars || {}),
    [levelId]: Math.max(data?.stars?.[levelId] || 0, stars),
  };

  const unlocked = new Set(data?.unlockedLevels || []);
  unlocked.add(levelId);
  if (nextLevel) unlocked.add(nextLevel);

  await updateDoc(ref, {
    stars: updatedStars,
    unlockedLevels: Array.from(unlocked),
    currentLevel: nextLevel || levelId,
  });
}