/*
  Warnings:

  - A unique constraint covering the columns `[handle]` on the table `Designer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Designer" ADD COLUMN     "handle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Designer_handle_key" ON "Designer"("handle");
