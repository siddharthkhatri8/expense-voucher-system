import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:5001";

export default function DirectorActions({ voucher, token, onUpdated }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);

  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!decision || !canvasRef.current) return;

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
  }, [decision]);

  function position(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event) {
    event.preventDefault();
    canvasRef.current.setPointerCapture?.(event.pointerId);

    const point = position(event);
    const context = canvasRef.current.getContext("2d");

    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
  }

  function draw(event) {
    if (!drawingRef.current) return;

    event.preventDefault();

    const point = position(event);
    const context = canvasRef.current.getContext("2d");

    context.lineTo(point.x, point.y);
    context.stroke();
    hasSignatureRef.current = true;
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    hasSignatureRef.current = false;
    setError("");
  }

  async function submitDecision(event) {
    event.preventDefault();
    setError("");

    if (!hasSignatureRef.current) {
      setError("Please draw the director's signature.");
      return;
    }

    if (decision === "reject" && !reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }

    setLoading(true);

    try {
      const directorSignature = canvasRef.current.toDataURL("image/png");

      const endpoint =
        decision === "approve"
          ? `/api/director/${voucher.id}/approve`
          : `/api/director/${voucher.id}/reject`;

      const body =
        decision === "approve"
          ? { director_signature: directorSignature }
          : {
              director_signature: directorSignature,
              rejection_reason: reason.trim(),
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not process this voucher.");
      }

      await onUpdated();
      setDecision("");
      setReason("");
    } catch (err) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (voucher.status !== "pending_approval") {
    return <span>—</span>;
  }

  return (
    <div className="voucher-actions">
      {!decision ? (
        <div className="form-actions">
          <button
            className="primary-button"
            onClick={() => setDecision("approve")}
          >
            Approve
          </button>
          <button
            className="nav-item"
            onClick={() => setDecision("reject")}
          >
            Reject
          </button>
        </div>
      ) : (
        <form onSubmit={submitDecision} className="director-form">
          <strong>
            {decision === "approve" ? "Approve voucher" : "Reject voucher"}
          </strong>

          {decision === "reject" && (
            <>
              <label htmlFor={`reason-${voucher.id}`}>
                Rejection reason
              </label>
              <textarea
                id={`reason-${voucher.id}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                rows={3}
                placeholder="Explain why this voucher is rejected"
              />
            </>
          )}

          <p>Draw director signature:</p>

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
              aria-label="Director signature"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="nav-item"
              onClick={clearSignature}
              disabled={loading}
            >
              Clear
            </button>

            <button
              type="button"
              className="nav-item"
              onClick={() => {
                setDecision("");
                setError("");
              }}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : decision === "approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="login-error">{error}</p>}
    </div>
  );
}