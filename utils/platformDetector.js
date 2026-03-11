function detectPlatform() {

  const host = window.location.hostname;

  if (host.includes("myntra")) {
    return "myntra";
  }

  return "unknown";
}