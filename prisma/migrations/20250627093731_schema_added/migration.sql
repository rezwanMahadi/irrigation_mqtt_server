-- CreateTable
CREATE TABLE "sensorsData" (
    "id" SERIAL NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "soilMoisture" INTEGER NOT NULL,
    "waterLevel" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensorsData_pkey" PRIMARY KEY ("id")
);
