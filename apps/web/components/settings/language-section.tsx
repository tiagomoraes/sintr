import { Button, FieldHint, Select } from "@sintr/ui";
import { languageName } from "@/lib/format";
import { currentLanguage } from "@/lib/server/language";
import { LANGUAGES, messagesFor } from "@/messages";

/**
 * The language sintr speaks to the person, said as a sentence with who
 * decided it, and the choice to change it or give it back (DECISIONS 98).
 * A plain form: it works without JavaScript.
 */
export async function LanguageSection() {
  const language = await currentLanguage();
  const t = messagesFor(language.code).language;
  const name = languageName(language.code, language.code);
  return (
    <>
      <p className="mt-3 text-ink-2">{t.summary[language.source](name)}</p>
      <p className="mt-3 text-[0.9375rem] text-ink-3">{t.body}</p>
      <form method="post" action="/api/language" className="mt-8">
        <input type="hidden" name="next" value="/settings" />
        <label htmlFor="language" className="block text-label font-medium text-ink">
          {t.label}
        </label>
        <Select
          id="language"
          name="language"
          defaultValue={language.source === "person" ? language.code : ""}
          className="mt-2 max-w-md"
        >
          <option value="">{t.automatic}</option>
          {LANGUAGES.map((option) => (
            <option key={option.code} value={option.code} lang={option.code}>
              {option.name}
            </option>
          ))}
        </Select>
        <FieldHint>{t.automaticHint}</FieldHint>
        <Button type="submit" variant="outline" className="mt-6">
          {t.save}
        </Button>
      </form>
    </>
  );
}
