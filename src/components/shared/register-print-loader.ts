import type { RegisterPrintData } from "./register-print-view";

export async function openDeferredRegisterPrintWindow(doc: RegisterPrintData): Promise<void> {
  const printWindow = window.open("", "_blank", "width=800,height=600");

  if (!printWindow) {
    window.alert("Could not open the print view. Please allow pop-ups and try again.");
    return;
  }

  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write("<!doctype html><title>Loading register sheet</title><body>Loading register sheet...</body>");
  printWindow.document.close();

  try {
    const { openRegisterPrintWindow } = await import("./register-print-view");
    openRegisterPrintWindow(doc, printWindow);
  } catch (error) {
    console.error("Failed to load register print view", error);
    printWindow.close();
    window.alert("Could not load the print view. Please try again.");
  }
}
