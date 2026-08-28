// ============================================================
// mock-data.js — Demo / simulation data for EmailFinder
// All data is fabricated for demonstration purposes only.
// ============================================================

const MOCK_DATA = {

  // ── Dashboard statistics ──────────────────────────────────
  stats: {
    emailsFound:  1248,
    verified:     3482,
    valid:        2761,
    successRate:  79.3
  },

  // ── Recent activity shown on the dashboard ────────────────
  recentActivity: [
    { firstName:"John",    lastName:"Smith",    company:"ABC Technologies", email:"john.smith@abctech.com",      confidence:96, status:"valid"   },
    { firstName:"Sarah",   lastName:"Wilson",   company:"XYZ Ltd",          email:"sarah.wilson@xyz.com",         confidence:91, status:"valid"   },
    { firstName:"Michael", lastName:"Brown",    company:"TechCorp Inc",     email:"michael.brown@techcorp.com",   confidence:84, status:"valid"   },
    { firstName:"Emily",   lastName:"Johnson",  company:"StartupHub",       email:"emily.j@startuphub.io",        confidence:67, status:"unknown" },
    { firstName:"David",   lastName:"Martinez", company:"Global Ventures",  email:"d.martinez@globalventures.co", confidence:78, status:"valid"   },
    { firstName:"Lisa",    lastName:"Taylor",   company:"InnovateTech",     email:"lisa.taylor@innovatetech.com", confidence:88, status:"valid"   }
  ],

  // ── Demo verification examples (keyed by email) ──────────
  verificationExamples: {
    "john.smith@abctech.com": {
      status:"valid", confidence:96, syntax:true, domain:true, mx:true,
      smtp:"simulated", catchAll:false, disposable:false, role:false,
      pattern:"firstname.lastname"
    },
    "test@example.com": {
      status:"unknown", confidence:50, syntax:true, domain:true, mx:true,
      smtp:"simulated", catchAll:true, disposable:false, role:false,
      pattern:"generic"
    },
    "invalid-email": {
      status:"invalid", confidence:0, syntax:false, domain:false, mx:false,
      smtp:"skipped", catchAll:false, disposable:false, role:false,
      pattern:"none"
    }
  },

  // ── Bulk CSV sample rows ──────────────────────────────────
  sampleCSVRows: [
    { first_name:"Alice",   last_name:"Chen",      company:"CloudBase",      domain:"cloudbase.io"   },
    { first_name:"Bob",     last_name:"Nguyen",    company:"FinStack",       domain:"finstack.com"   },
    { first_name:"Carol",   last_name:"Murphy",    company:"DevSpark",       domain:"devspark.co"    },
    { first_name:"Dan",     last_name:"Park",      company:"Nexify",         domain:"nexify.com"     },
    { first_name:"Emma",    last_name:"Shah",      company:"Rapidworks",     domain:"rapidworks.io"  }
  ],

  // ── Common domain providers (excluded from MX success) ───
  freeEmailDomains: [
    "gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com",
    "aol.com","protonmail.com","zoho.com","yandex.com","mail.com"
  ],

  // ── Disposable email domains ──────────────────────────────
  disposableDomains: [
    "mailinator.com","guerrillamail.com","10minutemail.com",
    "throwaway.email","yopmail.com","trashmail.com",
    "tempmail.com","fakeinbox.com","sharklasers.com"
  ],

  // ── Role/generic addresses ────────────────────────────────
  roleAddresses: [
    "admin","info","support","contact","hello","help","sales",
    "billing","noreply","no-reply","webmaster","postmaster","abuse",
    "security","team","careers","jobs","press","media"
  ],

  // ── Email patterns catalogue ──────────────────────────────
  patterns: [
    { id:"firstname.lastname",       label:"First.Last",        example:"john.smith"       },
    { id:"firstnamelastname",        label:"FirstLast",         example:"johnsmith"        },
    { id:"firstname",                label:"First",             example:"john"             },
    { id:"lastname",                 label:"Last",              example:"smith"            },
    { id:"firstinitiallastname",     label:"FLast",             example:"jsmith"           },
    { id:"firstinitial.lastname",    label:"F.Last",            example:"j.smith"          },
    { id:"firstname.lastinitial",    label:"First.L",           example:"john.s"           },
    { id:"lastname.firstname",       label:"Last.First",        example:"smith.john"       },
    { id:"lastnamefirstname",        label:"LastFirst",         example:"smithjohn"        },
    { id:"firstname_lastname",       label:"First_Last",        example:"john_smith"       },
    { id:"firstnamelastinitial",     label:"FirstL",            example:"johns"            },
    { id:"firstinitialslastinitial", label:"FL",                example:"js"               }
  ],

  // ── Pricing plans ─────────────────────────────────────────
  plans: [
    {
      name:"Free", price:{ monthly:0, annual:0 }, color:"#6b7280",
      searches:100, features:[
        "100 searches / month","Email pattern finder",
        "Basic results","Search history","CSV export (25 rows)"
      ]
    },
    {
      name:"Pro", price:{ monthly:29, annual:23 }, color:"#6366f1", popular:true,
      searches:5000, features:[
        "5,000 searches / month","Bulk finder (1,000 rows)",
        "CSV import & export","Advanced confidence scores",
        "Full history","Priority support"
      ]
    },
    {
      name:"Business", price:{ monthly:99, annual:79 }, color:"#06b6d4",
      searches:25000, features:[
        "25,000 searches / month","Bulk processing (10,000 rows)",
        "Team workspace","Advanced analytics",
        "API access (coming soon)","Dedicated support"
      ]
    }
  ]
};

// ── Expose globally ───────────────────────────────────────────
window.MOCK_DATA = MOCK_DATA;
