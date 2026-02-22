interface LayoutProps {
  preheader?: string;
  children: string;
}

const PRIMARY = "#5e3a8c";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

export function emailLayout({ preheader, children }: LayoutProps): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BookMe</title>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden">${preheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
          <!-- Header -->
          <tr>
            <td style="background:${PRIMARY};padding:24px 32px">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">BookMe</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px">
              ${children}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BORDER}">
              <p style="margin:0;font-size:12px;color:${MUTED};text-align:center">
                Mikael Feltenmark &middot; Tech &amp; Change by Feltenmark AB
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0">
  <tr>
    <td style="background:${PRIMARY};border-radius:8px;padding:12px 28px">
      <a href="${href}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block">${text}</a>
    </td>
  </tr>
</table>`;
}

export function emailInfoBox(lines: string[]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;background:#f8f5fc;border-radius:8px;border:1px solid #ede9f3">
  <tr>
    <td style="padding:16px 20px">
      ${lines.map((l) => `<p style="margin:4px 0;font-size:14px;color:#1f2937">${l}</p>`).join("")}
    </td>
  </tr>
</table>`;
}

export { PRIMARY, MUTED, BORDER };
