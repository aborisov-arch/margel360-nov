import { MessageCircle } from "lucide-react";

const WhatsAppButton = () => (
  <a
    href="https://wa.me/359888100070"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Свържете се чрез WhatsApp"
    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
    style={{ backgroundColor: "#25D366" }}
  >
    <MessageCircle size={28} className="text-white" />
  </a>
);

export default WhatsAppButton;
