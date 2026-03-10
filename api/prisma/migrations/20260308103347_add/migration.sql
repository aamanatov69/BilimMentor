-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "StudentLessonProgress" DROP CONSTRAINT "StudentLessonProgress_courseId_fkey";

-- DropForeignKey
ALTER TABLE "StudentLessonProgress" DROP CONSTRAINT "StudentLessonProgress_studentId_fkey";

-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "StudentLessonProgress" ALTER COLUMN "courseId" SET DATA TYPE TEXT,
ALTER COLUMN "studentId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
