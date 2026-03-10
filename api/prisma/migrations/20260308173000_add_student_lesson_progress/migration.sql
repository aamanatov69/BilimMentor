-- CreateTable
CREATE TABLE "StudentLessonProgress" (
  "id" VARCHAR(64) NOT NULL,
  "courseId" VARCHAR(64) NOT NULL,
  "studentId" VARCHAR(64) NOT NULL,
  "lessonId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentLessonProgress_courseId_studentId_lessonId_key"
ON "StudentLessonProgress"("courseId", "studentId", "lessonId");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_studentId_idx"
ON "StudentLessonProgress"("studentId");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_courseId_idx"
ON "StudentLessonProgress"("courseId");

-- AddForeignKey
ALTER TABLE "StudentLessonProgress"
ADD CONSTRAINT "StudentLessonProgress_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress"
ADD CONSTRAINT "StudentLessonProgress_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
