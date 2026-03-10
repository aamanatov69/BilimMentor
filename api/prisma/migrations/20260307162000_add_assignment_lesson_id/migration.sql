-- Link assignments to a specific lesson (stored by lesson id from course modules JSON)
ALTER TABLE "Assignment"
ADD COLUMN "lessonId" TEXT;
