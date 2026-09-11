import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/invoices/[id]/pdf">,
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: { customer: true, items: true, payments: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = invoice.currency;
  const company = settings?.companyName ?? "Your Company";
  const totalPaid = invoice.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(invoice.total) - totalPaid);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const stream = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc.fontSize(22).font("Helvetica-Bold").text(company, 50, 50);
  doc.fontSize(10).font("Helvetica").fillColor("#6b7280");
  if (settings?.companyAddress) doc.text(settings.companyAddress, 50);
  if (settings?.companyEmail) doc.text(settings.companyEmail, 50);
  if (settings?.companyPhone) doc.text(settings.companyPhone, 50);

  doc.fillColor("#111827").fontSize(20).font("Helvetica-Bold").text("INVOICE", 400, 50);
  doc.fontSize(10).font("Helvetica").fillColor("#6b7280");
  doc.text(`Invoice #${invoice.invoiceNumber}`, 400, 78);
  doc.text(`Issued: ${formatDate(invoice.issueDate)}`, 400, 92);
  doc.text(`Due: ${formatDate(invoice.dueDate)}`, 400, 106);
  doc.text(`Status: ${titleCase(invoice.status)}`, 400, 120);

  // Bill to
  doc.moveDown(2);
  doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold").text("BILL TO", 50, 170);
  doc.font("Helvetica").fillColor("#374151");
  doc.text(invoice.customer.name, 50, 186);
  if (invoice.customer.company) doc.text(invoice.customer.company, 50);
  if (invoice.customer.email) doc.text(invoice.customer.email, 50);
  if (invoice.customer.phone) doc.text(invoice.customer.phone, 50);
  if (invoice.customer.address) doc.text(invoice.customer.address, 50);

  // Items table
  const tableTop = 270;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#6b7280");
  doc.text("DESCRIPTION", 50, tableTop);
  doc.text("QTY", 320, tableTop, { width: 50, align: "right" });
  doc.text("UNIT PRICE", 400, tableTop, { width: 70, align: "right" });
  doc.text("TOTAL", 500, tableTop, { width: 50, align: "right" });
  doc.moveTo(50, tableTop + 14).lineTo(550, tableTop + 14).strokeColor("#e5e7eb").stroke();

  let y = tableTop + 24;
  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  for (const it of invoice.items) {
    doc.text(it.description, 50, y, { width: 260 });
    doc.text(String(Number(it.quantity)), 320, y, { width: 50, align: "right" });
    doc.text(formatCurrency(it.unitPrice, currency), 400, y, { width: 70, align: "right" });
    doc.text(formatCurrency(it.total, currency), 500, y, { width: 50, align: "right" });
    y += 22;
  }

  // Totals
  y += 10;
  doc.moveTo(50, y).lineTo(550, y).strokeColor("#e5e7eb").stroke();
  y += 16;
  const labelX = 380;
  const valueX = 500;
  doc.fontSize(10);
  doc.text("Subtotal", labelX, y, { width: 110, align: "right" });
  doc.text(formatCurrency(invoice.subtotal, currency), valueX, y, { width: 50, align: "right" });
  y += 16;
  doc.text(`Tax (${Number(invoice.taxRate)}%)`, labelX, y, { width: 110, align: "right" });
  doc.text(formatCurrency(invoice.taxAmount, currency), valueX, y, { width: 50, align: "right" });
  y += 16;
  doc.text("Discount", labelX, y, { width: 110, align: "right" });
  doc.text(`-${formatCurrency(invoice.discount, currency)}`, valueX, y, { width: 50, align: "right" });
  y += 16;
  doc.font("Helvetica-Bold").fontSize(12);
  doc.text("Total", labelX, y, { width: 110, align: "right" });
  doc.text(formatCurrency(invoice.total, currency), valueX, y, { width: 50, align: "right" });
  y += 18;
  doc.font("Helvetica").fontSize(10).fillColor("#059669");
  doc.text("Paid", labelX, y, { width: 110, align: "right" });
  doc.text(formatCurrency(totalPaid, currency), valueX, y, { width: 50, align: "right" });
  y += 16;
  doc.fillColor("#e11d48").font("Helvetica-Bold");
  doc.text("Amount Due", labelX, y, { width: 110, align: "right" });
  doc.text(formatCurrency(remaining, currency), valueX, y, { width: 50, align: "right" });

  if (invoice.notes) {
    y += 40;
    doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(9).text("NOTES", 50, y);
    y += 14;
    doc.font("Helvetica").fontSize(10).fillColor("#374151").text(invoice.notes, 50, y, { width: 500 });
  }

  doc.end();

  const buffer = await stream;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
