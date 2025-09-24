CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals("Owner Name");
CREATE INDEX IF NOT EXISTS idx_deals_sdr ON deals("--- SDR AGENT --- REQUIRED FIELD ---");
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals("Deal Creation Date Time");
CREATE INDEX IF NOT EXISTS idx_deals_distributed ON deals("DISTRIBUTION Time");
CREATE INDEX IF NOT EXISTS idx_deals_call_created ON deals("CALENDLY Event Created At");
CREATE INDEX IF NOT EXISTS idx_deals_call_time ON deals("CALENDLY Time");
CREATE INDEX IF NOT EXISTS idx_deals_prop_sent ON deals("Deal Proposal Sent Date Time");
CREATE INDEX IF NOT EXISTS idx_deals_prop_signed ON deals("Deal Proposal Signed Date Time");
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts("Date Created");
