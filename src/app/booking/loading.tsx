export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#080808",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "3px solid #1A1A1A",
          borderTopColor: "#D4AF37",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p
        style={{
          color: "#666",
          fontSize: "13px",
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}
      >
        Chargement...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
