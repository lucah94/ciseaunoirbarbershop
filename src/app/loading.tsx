export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#080808",
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
