# Privacy Policy

**Last updated: August 14, 2026**

This Privacy Policy explains how the **gsheets-timeline** Google Sheets extension ("the Add-on," "the Service," "we," "us," or "our") handles information when you use it. We built this Add-on with a privacy-first design: it operates within your own Google Sheets environment and does not send your spreadsheet data to any external server that we control.

## 1. Overview of How the Add-on Works

gsheets-timeline runs inside Google Sheets, powered by Google Apps Script. When you open the modal:

- The Add-on reads data directly from the active Google Sheet you have open
- It renders that data as a visual timeline within the modal, using a React-based interface
- You choose which columns are used for task names, start dates, end dates, due dates, and popup metadata
- Clicking "Update" re-reads the current data from your active sheet to refresh the timeline

All of this processing happens within Google's infrastructure (Google Apps Script and your browser rendering the modal). The Add-on does not have its own backend server, and it does not transmit your spreadsheet content to us or to any third party.

## 2. Information We Do Not Collect

We do not collect, store, sell, or share:

- The content of your Google Sheets (task names, dates, owners, statuses, notes, or any other cell data)
- Personally identifiable information contained in your spreadsheets
- Your Google account credentials
- Any files, documents, or attachments from your Google Drive

The Add-on has no analytics, tracking pixels, advertising identifiers, or third-party marketing SDKs embedded in it.

## 3. Google Permissions ("Scopes")

To function inside Google Sheets, the Add-on may request certain Google Apps Script authorization scopes, such as permission to read data from the active spreadsheet and to display a custom modal/menu. These permissions are requested solely to enable the Add-on's core functionality (reading your sheet's data to render a timeline) and are:

- Requested through Google's own OAuth consent flow, which you control
- Used only locally, within the Apps Script execution tied to your own Google account and spreadsheet
- Never used to access spreadsheets, files, or data outside of what is needed to render the timeline in the sheet where the Add-on is installed

You can review or revoke the Add-on's permissions at any time through your [Google Account security settings](https://myaccount.google.com/permissions).

## 4. Local Development Version

The repository also includes a local React application intended for previewing the timeline component outside of Google Sheets, typically used by developers during development (via `npm install` / `npm run dev`). This local development environment runs entirely on your own machine and does not transmit data anywhere. It is not part of the installed Google Sheets Add-on experience used by end users.

## 5. Data Storage

Because the Add-on does not have an external backend, it does not store your spreadsheet data outside of Google's own infrastructure. Any configuration you set (such as which columns map to which timeline fields) is handled within the modal session and/or stored using Google Apps Script's own storage mechanisms (if applicable) tied to your spreadsheet — not on servers operated by us.

## 6. Third-Party Services

The Add-on runs on top of Google Sheets and Google Apps Script, which are products of Google LLC. Your use of Google Sheets is subject to Google's own privacy policies and terms, available at:

- [Google Privacy Policy](https://policies.google.com/privacy)
- [Google Terms of Service](https://policies.google.com/terms)

We do not control and are not responsible for how Google processes data within its own products.

## 7. Children's Privacy

The Add-on is not directed at children under the age of 13 (or the minimum age required by your jurisdiction), and we do not knowingly collect personal information from children, as the Add-on does not collect personal information at all.

## 8. Data Security

Since the Add-on does not transmit your spreadsheet data to us, the security of your data while using the Add-on is primarily governed by Google's security practices and your own account security (e.g., using strong passwords, enabling two-factor authentication, and managing sharing permissions on your spreadsheets).

## 9. Your Rights and Choices

Because we do not collect or store your personal data, there is generally no personal data held by us for you to access, correct, or delete. If you wish to stop the Add-on from having any access to your spreadsheet, you can:

- Remove the Apps Script project associated with the Add-on from your Google Sheet, and/or
- Revoke the Add-on's permissions via your [Google Account permissions page](https://myaccount.google.com/permissions)

## 10. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in the Add-on's functionality or for legal or regulatory reasons. Any changes will be reflected by updating the "Last updated" date at the top of this document. We encourage you to review this page periodically.

## 11. Contact

If you have any questions about this Privacy Policy or how the Add-on handles data, please open an issue on the project's GitHub repository:

[https://github.com/leosole/gsheets-timeline](https://github.com/leosole/gsheets-timeline)

---

*This Privacy Policy is provided as a general template and does not constitute legal advice. You may wish to consult a legal professional to ensure this policy meets your specific needs and complies with applicable data protection laws in your jurisdiction (e.g., GDPR, CCPA, LGPD).*
