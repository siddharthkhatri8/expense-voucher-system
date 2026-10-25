import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:5001";

export default function VoucherActions({ voucher, token, onUpdated }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);

  const [showSignature, setShowSignature] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!showSignature || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111";

    hasSignatureRef.current = false;
  }, [showSignature]);

  if (voucher.status !== "draft") {
    return <span>—</span>;
  }

  function getPosition(event) {
    const rect = canvasRef.current.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture?.(event.pointerId);

    const context = canvas.getContext("2d");
    const { x, y } = getPosition(event);

    context.beginPath();
    context.moveTo(x, y);
    drawingRef.current = true;
  }

  function draw(event) {
    if (!drawingRef.current) return;

    event.preventDefault();

    const context = canvasRef.current.getContext("2d");
    const { x, y } = getPosition(event);

    context.lineTo(x, y);
    context.stroke();
    hasSignatureRef.current = true;
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
    hasSignatureRef.current = false;
    setError("");
  }

  async function signAndSubmit() {
    if (!hasSignatureRef.current) {
      setError("Please draw your signature before submitting.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const signatureData = canvasRef.current.toDataURL("image/png");

      const signResponse = await fetch(
        `${API_URL}/api/vouchers/${voucher.id}/sign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            signature_data: signatureData,
          }),
        }
      );

      const signData = await signResponse.json();

      if (!signResponse.ok) {
        throw new Error(signData.message || "Could not save signature.");
      }

      const submitResponse = await fetch(
        `${API_URL}/api/vouchers/${voucher.id}/submit`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const submitData = await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(
          submitData.message || "Signature saved, but submission failed."
        );
      }

      setShowSignature(false);
      await onUpdated();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="voucher-actions">
      {!showSignature ? (
        <button
          className="primary-button"
          onClick={() => {
            setError("");
            setShowSignature(true);
          }}
        >
          Sign & Submit
        </button>
      ) : (
        <>
          <div className="signature-canvas">
            <canvas
              ref={canvasRef}
              className="signature-drawing"
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={stopDrawing}
              style={{ touchAction: "none" }}
              aria-label="Draw your signature"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="nav-item"
              disabled={loading}
              onClick={clearSignature}
            >
              Clear
            </button>

            <button
              type="button"
              className="nav-item"
              disabled={loading}
              onClick={() => setShowSignature(false)}
            >
              Cancel
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={loading}
              onClick={signAndSubmit}
            >
              {loading ? "Submitting..." : "Confirm & Submit"}
            </button>
          </div>
        </>
      )}

      {error && <p className="login-error">{error}</p>}
    </div>
  );
}