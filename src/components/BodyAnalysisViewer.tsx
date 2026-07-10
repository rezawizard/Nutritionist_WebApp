import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight, Eye, FileText, LoaderCircle, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Attachment, AttachmentPreview } from "../types";

function decodeBase64(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default function BodyAnalysisViewer({ attachment, onOpen }: { attachment: Attachment | null; onOpen: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const extension = useMemo(() => (attachment?.file_name.split(".").pop() || "").toLowerCase(), [attachment]);
  const isImage = ["png", "jpg", "jpeg", "webp", "bmp", "gif"].includes(extension);
  const isPdf = extension === "pdf";
  const imageUrl = useMemo(() => attachment && isImage ? convertFileSrc(attachment.local_path) : "", [attachment, isImage]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPageNumber(1);
    setError("");
    setPdfDocument(null);
    if (!attachment?.id || !isPdf) return;

    let active = true;
    let loadedDocument: PDFDocumentProxy | null = null;
    setLoading(true);
    void (async () => {
      try {
        const [{ getDocument, GlobalWorkerOptions }, workerModule, payload] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
          invoke<AttachmentPreview>("read_attachment_preview", { attachmentId: attachment.id }),
        ]);
        GlobalWorkerOptions.workerSrc = workerModule.default;
        const task = getDocument({ data: decodeBase64(payload.base64_data) });
        loadedDocument = await task.promise;
        if (active) setPdfDocument(loadedDocument);
        else await loadedDocument.destroy();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : String(reason || "پیش‌نمایش PDF آماده نشد."));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [attachment?.id, isPdf]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current || !isPdf) return;
    let active = true;
    setRendering(true);
    renderTaskRef.current?.cancel();
    void pdfDocument.getPage(pageNumber).then((page) => {
      if (!active || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: Math.max(0.75, zoom * 1.35), rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas renderer is unavailable.");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const renderTask = page.render({ canvas, canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      return renderTask.promise;
    }).catch((reason) => {
      if (active && reason?.name !== "RenderingCancelledException") setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (active) setRendering(false);
    });
    return () => {
      active = false;
      renderTaskRef.current?.cancel();
    };
  }, [pdfDocument, pageNumber, zoom, rotation, isPdf]);

  if (!attachment) {
    return <div className="body-viewer-empty"><FileText size={30} /><strong>هنوز بادی آنالیز بارگذاری نشده است</strong><span>از تب فایل‌ها، دسته «بادی آنالیز» را انتخاب کنید.</span></div>;
  }

  const totalPages = pdfDocument?.numPages ?? 0;
  const decreaseZoom = () => setZoom((value) => Math.max(0.55, Number((value - 0.15).toFixed(2))));
  const increaseZoom = () => setZoom((value) => Math.min(2.4, Number((value + 0.15).toFixed(2))));

  return (
    <div className={`body-viewer-shell ${fullscreen ? "body-viewer-fullscreen" : ""}`}>
      <div className="body-viewer-toolbar">
        <div className="body-viewer-title">
          <strong>{attachment.title || attachment.file_name}</strong>
          <small>{attachment.attachment_date || "فایل پرونده"}{isPdf && totalPages ? ` · ${totalPages} صفحه` : ""}</small>
        </div>
        <div className="body-viewer-actions">
          {isPdf && totalPages > 1 && <div className="body-viewer-pagination"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => Math.max(1, value - 1))} aria-label="صفحه قبل"><ChevronRight size={17} /></button><span>{pageNumber} / {totalPages}</span><button type="button" disabled={pageNumber >= totalPages} onClick={() => setPageNumber((value) => Math.min(totalPages, value + 1))} aria-label="صفحه بعد"><ChevronLeft size={17} /></button></div>}
          {(isImage || isPdf) && <>
            <button type="button" onClick={decreaseZoom} aria-label="کوچک‌نمایی"><ZoomOut size={17} /></button>
            <span>{Math.round(zoom * 100)}٪</span>
            <button type="button" onClick={increaseZoom} aria-label="بزرگ‌نمایی"><ZoomIn size={17} /></button>
            <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="چرخش"><RotateCcw size={17} /></button>
            <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label="نمایش بزرگ"><Maximize2 size={17} /></button>
          </>}
          <button type="button" onClick={onOpen}><Eye size={17} /> بازکردن کامل</button>
        </div>
      </div>
      <div className="body-viewer-stage">
        {(loading || rendering) && <div className="body-viewer-loading"><LoaderCircle className="animate-spin" /><span>{loading ? "در حال آماده‌سازی PDF…" : "در حال رسم صفحه…"}</span></div>}
        {error && <div className="body-viewer-error"><strong>پیش‌نمایش داخل اپ آماده نشد</strong><span>{error}</span><button type="button" onClick={onOpen}>بازکردن با برنامه ویندوز</button></div>}
        {!error && isImage && imageUrl && <div className="body-image-scroll"><img src={imageUrl} alt={attachment.title || "بادی آنالیز"} style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} /></div>}
        {!error && isPdf && <div className="body-pdf-scroll"><canvas ref={canvasRef} aria-label={`صفحه ${pageNumber} فایل بادی آنالیز`} /></div>}
        {!loading && !error && !isImage && !isPdf && <div className="body-viewer-error"><strong>این فرمت پیش‌نمایش داخلی ندارد</strong><button type="button" onClick={onOpen}>بازکردن فایل</button></div>}
      </div>
    </div>
  );
}
