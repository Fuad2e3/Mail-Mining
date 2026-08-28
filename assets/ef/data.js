// ============================================================================
// data.js — reference data for the EmailFinder app
//
// Domain/role lists drive the scoring engine. Plans mirror the packages the
// backend already understands (free / pro / enterprise) so the pricing page
// can submit a real upgrade request.
// ============================================================================

'use strict';

const EF_DATA = {

  // Free mailbox providers — a hit here means the address is almost certainly
  // personal, not a company mailbox, so company patterns score lower.
  freeEmailDomains: [
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com',
    'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com',
    'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com', 'mail.com',
    'gmx.com', 'gmx.net', 'fastmail.com', 'tutanota.com'
  ],

  // Throwaway inbox providers — anything here is flagged invalid.
  disposableDomains: [
    'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'yopmail.com', 'trashmail.com', 'tempmail.com', 'temp-mail.org', 'fakeinbox.com',
    'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
    'mohmal.com', 'moakt.com', 'emailondeck.com', 'spamgourmet.com'
  ],

  // Shared/role mailboxes — deliverable but rarely the person you want.
  roleAddresses: [
    'admin', 'administrator', 'info', 'support', 'contact', 'hello', 'help',
    'sales', 'billing', 'accounts', 'accounting', 'finance', 'noreply',
    'no-reply', 'donotreply', 'webmaster', 'postmaster', 'hostmaster', 'abuse',
    'security', 'team', 'office', 'careers', 'jobs', 'hr', 'recruitment',
    'press', 'media', 'marketing', 'newsletter', 'enquiries', 'inquiries'
  ],

  // Catalogue shown on the finder page.
  patterns: [
    { id: 'firstname.lastname',       label: 'First.Last',  example: 'john.smith' },
    { id: 'firstnamelastname',        label: 'FirstLast',   example: 'johnsmith' },
    { id: 'firstinitiallastname',     label: 'FLast',       example: 'jsmith' },
    { id: 'firstinitial.lastname',    label: 'F.Last',      example: 'j.smith' },
    { id: 'firstname',                label: 'First',       example: 'john' },
    { id: 'lastname',                 label: 'Last',        example: 'smith' },
    { id: 'lastname.firstname',       label: 'Last.First',  example: 'smith.john' },
    { id: 'lastnamefirstname',        label: 'LastFirst',   example: 'smithjohn' },
    { id: 'firstname.lastinitial',    label: 'First.L',     example: 'john.s' },
    { id: 'firstname_lastname',       label: 'First_Last',  example: 'john_smith' },
    { id: 'firstnamelastinitial',     label: 'FirstL',      example: 'johns' },
    { id: 'firstinitialslastinitial', label: 'FL',          example: 'js' }
  ],

  // Packages the API accepts on /api/auth/upgrade-request.
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: { monthly: 0, annual: 0 },
      credits: 50,
      creditsLabel: '50 credits / day',
      features: [
        '50 searches per day',
        'Email pattern finder',
        'Single email verification',
        'Local search history',
        'CSV export'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: { monthly: 29, annual: 23 },
      credits: 1000,
      creditsLabel: '1,000 credits / day',
      popular: true,
      features: [
        '1,000 searches per day',
        'Bulk finder with CSV upload',
        'Full verification breakdown',
        'Unlimited local history',
        'Priority processing',
        'Priority support'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: { monthly: 99, annual: 79 },
      credits: 999999,
      creditsLabel: 'Unlimited credits',
      features: [
        'Unlimited searches',
        'Unlimited bulk processing',
        'Team workspace',
        'Advanced analytics',
        'API access (coming soon)',
        'Dedicated support'
      ]
    }
  ],

  // Sample rows offered on the bulk finder page.
  sampleCSV:
    'first_name,last_name,company,domain\n' +
    'Alice,Chen,CloudBase,cloudbase.io\n' +
    'Bob,Nguyen,FinStack,finstack.com\n' +
    'Carol,Murphy,DevSpark,devspark.co\n' +
    'Dan,Park,Nexify,nexify.com\n' +
    'Emma,Shah,Rapidworks,rapidworks.io'
};

window.EF_DATA = EF_DATA;
