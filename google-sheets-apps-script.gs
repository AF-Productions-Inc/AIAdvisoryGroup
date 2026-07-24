// Google Apps Script — Chatbot Leads Web App
//
// Setup:
// 1. Create (or open) a Google Sheet for your leads.
// 2. Extensions → Apps Script. Delete any starter code and paste this in.
// 3. Deploy → New deployment → type "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Click Deploy, authorize it when prompted, and copy the Web App URL
//    it gives you (ends in /exec).
// 5. Add that URL in Vercel as GOOGLE_SHEETS_WEBHOOK_URL.
//
// This creates a "Leads" sheet (if it doesn't exist yet) and appends one
// row per lead/urgent event sent from the chatbot.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Leads');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Captured At', 'Type', 'Name', 'Email', 'Phone', 'Interest', 'Reason', 'Last Message']);
  }

  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.capturedAt || new Date().toISOString(),
    data.type || '',
    data.name || '',
    data.email || '',
    data.phone || '',
    data.interest || '',
    data.reason || '',
    data.lastMessage || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
