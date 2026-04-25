-- AddColumn google_subject to users
ALTER TABLE "users" ADD COLUMN "google_subject" TEXT;

-- CreateIndex on google_subject (unique)
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex on email (for fast lookup)
CREATE INDEX "users_email_idx" ON "users"("email");
