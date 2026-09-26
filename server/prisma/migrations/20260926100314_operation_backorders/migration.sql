-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "backorderOfId" INTEGER;

-- CreateIndex
CREATE INDEX "Operation_backorderOfId_idx" ON "Operation"("backorderOfId");

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_backorderOfId_fkey" FOREIGN KEY ("backorderOfId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
