-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'ACTIVE', 'RESIGNED');

-- CreateTable
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutiveTitle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameEnFull" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutiveTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "addressEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "nameKo" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "tel" TEXT NOT NULL,
    "fax" TEXT,
    "logoUrl" TEXT NOT NULL,
    "homepageUrl" TEXT,
    "homepageUrlEn" TEXT,
    "linkedinUrl" TEXT,
    "youtubeUrl" TEXT,
    "youtubeUrlEn" TEXT,
    "instagramUrl" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#931B82',
    "tagline" TEXT,
    "certifications" JSONB NOT NULL,
    "certificationsEn" JSONB NOT NULL DEFAULT '[]',
    "industry" TEXT,
    "industryEn" TEXT,
    "taglineEn" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nameKo" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "nameEn" TEXT,
    "rankId" TEXT,
    "executiveTitleId" TEXT,
    "positionId" TEXT,
    "teamId" TEXT,
    "partId" TEXT,
    "credential" TEXT,
    "credentialEn" TEXT,
    "bio" VARCHAR(80),
    "telWork" TEXT,
    "telMobile" TEXT,
    "mobilePublic" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileView" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rank_name_key" ON "Rank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveTitle_name_key" ON "ExecutiveTitle"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Part_teamId_idx" ON "Part"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_teamId_name_key" ON "Part"("teamId", "name");

-- CreateIndex
CREATE INDEX "Office_companyId_idx" ON "Office"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_slug_key" ON "Employee"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "Employee_rankId_idx" ON "Employee"("rankId");

-- CreateIndex
CREATE INDEX "Employee_executiveTitleId_idx" ON "Employee"("executiveTitleId");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- CreateIndex
CREATE INDEX "Employee_teamId_idx" ON "Employee"("teamId");

-- CreateIndex
CREATE INDEX "Employee_partId_idx" ON "Employee"("partId");

-- CreateIndex
CREATE INDEX "ProfileView_employeeId_createdAt_idx" ON "ProfileView"("employeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_executiveTitleId_fkey" FOREIGN KEY ("executiveTitleId") REFERENCES "ExecutiveTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
