const Footer = () => (
  <footer
    className="py-8 px-6 md:px-10"
    style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#000" }}
  >
    <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm font-bold text-white/70">АБИ — AB Intelligence</p>
      <p className="text-xs text-white/25">
        © {new Date().getFullYear()} АБИ. Всички права запазени.
      </p>
      <div className="flex items-center gap-6">
        <a
          href="https://www.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/25 hover:text-white transition-colors"
        >
          Facebook
        </a>
        <a
          href="https://www.instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/25 hover:text-white transition-colors"
        >
          Instagram
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
