-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cashfreeOrderId" TEXT,
ADD COLUMN     "cashfreePaymentId" TEXT,
ADD COLUMN     "gateway" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "cashfreeAppId" TEXT,
ADD COLUMN     "cashfreeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cashfreeEnvironment" TEXT NOT NULL DEFAULT 'sandbox',
ADD COLUMN     "cashfreeSecretKey" TEXT,
ADD COLUMN     "cashfreeWebhookSecret" TEXT;
