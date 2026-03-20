-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
