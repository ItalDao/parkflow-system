-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "assigned_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
