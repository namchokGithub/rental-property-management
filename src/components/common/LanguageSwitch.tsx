import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={language === "th" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage("th")}
      >
        ไทย
      </Button>
      <Button
        type="button"
        size="sm"
        variant={language === "en" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
    </div>
  );
}
