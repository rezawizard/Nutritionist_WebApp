import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Eye, FileText, LoaderCircle, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Attachment, AttachmentPreview } from "../types";

function decodeBase64(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default function BodyAnalysisViewer({ attachment, onOpen }: { attachment: Attachment | null; onOpen: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");

  const extension = useMemo(() => (attachment?.file_name.split(".").pop() || "").toLowerCase(), [attachment]);
  const isImage = ["png", "jpg", "jpeg", "webp", "bmp", "gif"].includes(extension);
  const isPdf = extension === "pdf";
  const imageUrl = useMemo(() => attachment && isImage ? convertFileSrc(attachment.local_path) : "", [attachment, isImage]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setError("");
    setPdfUrl("");
    if (!attachment?.id || !isPdf) return;

    let active = true;
    let objectUrl = "";
    setLoading(true);

    void invoke<AttachmentPreview>("read_attachment_preview", { attachmentId: attachment.id })
      .then((payload) => {
        const bytes = decodeBase64(payload.base64_data);
        const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        objectUrl = URL.createObjectURL(new Blob([data], { type: payload.mime_type || "application/pdf" }));
        if (active) setPdfUrl(objectUrl);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason || "پیش‌نمایش PDF آماده نشد."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment?.id, isPdf]);

  if (!attachment) {
    return <div className="body-viewer-empty"><FileText size={30} /><strong>هنوز بادی آنالیز بارگذاری نشده است</strong><span>از تب فایل‌ها، دسته «بادی آنالیز» را انتخاب کنید.</span></div>;
  }

  const decreaseZoom = () => setZoom((value) => Math.max(0.55, Number((value - 0.15).toFixed(2))));
  const increaseZoom = () => setZoom((value) => Math.min(2.4, Number((value + 0.15).toFixed(2))));
  const pdfViewerUrl = pdfUrl ? `${pdfUrl}#toolbar=1&navpanes=0&view=FitH` : "";

  return (
    <div className={`body-viewer-shell ${fullscreen ? "body-viewer-fullscreen" : ""}`}>
      <div className="body-viewer-toolbar">
        <div className="body-viewer-title">
          <strong>{attachment.title || attachment.file_name}</strong>
          <small>{attachment.attachment_date || "فایل پرونده"}{isPdf ? " · کنترل صفحات و بزرگ‌نمایی داخل نمایشگر PDF" : ""}</small>
        </div>
        <div className="body-viewer-actions">
          {isImage && <>
            <button type="button" onClick={decreaseZoom} aria-label="کوچک‌نمایی"><ZoomOut size={17} /></button>
            <span>{Math.round(zoom * 100)}٪</span>
            <button type="button" onClick={increaseZoom} aria-label="بزرگ‌نمایی"><ZoomIn size={17} /></button>
            <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="چرخش"><RotateCcw size={17} /></button>
          </>}
          {(isImage || isPdf) && <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label="نمایش بزرگ"><Maximize2 size={17} /></button>}
          <button type="button" onClick={onOpen}><Eye size={17} /> بازکردن کامل</button>
        </div>
      </div>
      <div className="body-viewer-stage">
        {loading && <div className="body-viewer-loading"><LoaderCircle className="animate-spin" /><span>در حال آماده‌سازی پیش‌نمایش…</span></div>}
        {error && <div className="body-viewer-error"><strong>پیش‌نمایش داخل اپ آماده نشد</strong><span>{error}</span><button type="button" onClick={onOpen}>بازکردن با برنامه ویندوز</button></div>}
        {!error && isImage && imageUrl && <div className="body-image-scroll"><img src={imageUrl} alt={attachment.title || "بادی آنالیز"} style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} /></div>}
        {!error && isPdf && pdfViewerUrl && <div className="body-pdf-scroll"><object data={pdfViewerUrl} type="application/pdf" aria-label={attachment.title || attachment.file_name}><div className="body-viewer-error"><strong>نمایشگر داخلی PDF در دسترس نیست</strong><button type="button" onClick={onOpen}>بازکردن با برنامه ویندوز</button></div></object></div>}
        {!loading && !error && !isImage && !isPdf && <div className="body-viewer-error"><strong>این فرمت پیش‌نمایش داخلی ندارد</strong><button type="button" onClick={onOpen}>بازکردن فایل</button></div>}
      </div>
    </div>
  );
}
