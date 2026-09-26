-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "LocType" AS ENUM ('INTERNAL', 'VENDOR', 'CUSTOMER', 'LOSS');

-- CreateEnum
CREATE TYPE "OpType" AS ENUM ('RECEIPT', 'DELIVERY', 'INTERNAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OpStatus" AS ENUM ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "otpHash" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "type" "LocType" NOT NULL,
    "warehouseId" INTEGER,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "reorderMin" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reorderQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockQuant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockQuant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "OpType" NOT NULL,
    "status" "OpStatus" NOT NULL DEFAULT 'DRAFT',
    "partner" TEXT,
    "sourceLocId" INTEGER NOT NULL,
    "destLocId" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationLine" (
    "id" SERIAL NOT NULL,
    "operationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "demandQty" DECIMAL(14,3) NOT NULL,
    "doneQty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "OperationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMove" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "fromLocId" INTEGER NOT NULL,
    "toLocId" INTEGER NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "operationId" INTEGER,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_fullName_key" ON "Location"("fullName");

-- CreateIndex
CREATE INDEX "Location_warehouseId_idx" ON "Location"("warehouseId");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "StockQuant_locationId_idx" ON "StockQuant"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockQuant_productId_locationId_key" ON "StockQuant"("productId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_reference_key" ON "Operation"("reference");

-- CreateIndex
CREATE INDEX "Operation_type_status_idx" ON "Operation"("type", "status");

-- CreateIndex
CREATE INDEX "Operation_status_idx" ON "Operation"("status");

-- CreateIndex
CREATE INDEX "Operation_scheduledDate_idx" ON "Operation"("scheduledDate");

-- CreateIndex
CREATE INDEX "OperationLine_productId_idx" ON "OperationLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationLine_operationId_productId_key" ON "OperationLine"("operationId", "productId");

-- CreateIndex
CREATE INDEX "StockMove_productId_createdAt_idx" ON "StockMove"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMove_fromLocId_idx" ON "StockMove"("fromLocId");

-- CreateIndex
CREATE INDEX "StockMove_toLocId_idx" ON "StockMove"("toLocId");

-- CreateIndex
CREATE INDEX "StockMove_operationId_idx" ON "StockMove"("operationId");

-- CreateIndex
CREATE INDEX "StockMove_createdAt_idx" ON "StockMove"("createdAt");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockQuant" ADD CONSTRAINT "StockQuant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockQuant" ADD CONSTRAINT "StockQuant_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_sourceLocId_fkey" FOREIGN KEY ("sourceLocId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_destLocId_fkey" FOREIGN KEY ("destLocId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLine" ADD CONSTRAINT "OperationLine_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLine" ADD CONSTRAINT "OperationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_fromLocId_fkey" FOREIGN KEY ("fromLocId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_toLocId_fkey" FOREIGN KEY ("toLocId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Integrity guarantees enforced by the database itself (not expressible in Prisma).
-- ============================================================================

-- Stock can never go negative, even if application code has a bug.
ALTER TABLE "StockQuant" ADD CONSTRAINT "StockQuant_quantity_nonneg" CHECK ("quantity" >= 0);

-- Every movement and every demanded quantity is strictly positive.
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_quantity_pos" CHECK ("quantity" > 0);
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_distinct_locs" CHECK ("fromLocId" <> "toLocId");
ALTER TABLE "OperationLine" ADD CONSTRAINT "OperationLine_demand_pos" CHECK ("demandQty" > 0);
ALTER TABLE "OperationLine" ADD CONSTRAINT "OperationLine_done_nonneg" CHECK ("doneQty" >= 0);
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_distinct_locs" CHECK ("sourceLocId" <> "destLocId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_reorder_nonneg" CHECK ("reorderMin" >= 0 AND "reorderQty" >= 0);

-- Virtual locations never belong to a warehouse; internal ones always do.
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouse_by_type"
  CHECK (("type" = 'INTERNAL') = ("warehouseId" IS NOT NULL));

-- The stock ledger is append-only: reject UPDATE and DELETE on StockMove.
CREATE FUNCTION stock_move_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'StockMove is an append-only ledger; % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_move_append_only
  BEFORE UPDATE OR DELETE ON "StockMove"
  FOR EACH ROW EXECUTE FUNCTION stock_move_append_only();
