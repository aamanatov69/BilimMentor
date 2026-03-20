-- DropForeignKey
ALTER TABLE "StudentLessonProgress" DROP CONSTRAINT "StudentLessonProgress_courseId_fkey";

-- DropForeignKey
ALTER TABLE "StudentLessonProgress" DROP CONSTRAINT "StudentLessonProgress_studentId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StudentLessonProgress" ALTER COLUMN "courseId" SET DATA TYPE TEXT,
ALTER COLUMN "studentId" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
