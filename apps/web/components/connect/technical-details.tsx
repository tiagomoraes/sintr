import { API_TOKEN_ACCESS } from "@sintr/core";
import { TOOLS, instructions } from "@sintr/mcp";
import { linkStyles } from "@sintr/ui";
import type { ReactNode } from "react";
import { bridgeUrl, mcpUrl } from "@/lib/connect";
import { getMessages } from "@/lib/server/language";
import { Snippet } from "./copy-button";

const DOCS = "https://github.com/tiagomoraes/sintr/blob/main/docs/MCP.md";

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-t border-rule py-5 first:border-t-0">
      <dt className="font-medium text-ink">{term}</dt>
      <dd className="mt-2 space-y-2 text-[0.9375rem] text-ink-2">{children}</dd>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[6px] bg-wash px-[0.38em] py-[0.08em] font-mono text-[0.85em] text-ink [overflow-wrap:anywhere]">
      {children}
    </code>
  );
}

/**
 * Everything a technical reader may want, out of the way of everyone else:
 * the endpoint, how the key travels, the bridge, the tools and their scopes,
 * and the full text the assistant is given. The tools' descriptions and the
 * instructions are shown as the assistant receives them, in English.
 */
export async function TechnicalDetails({ appUrl }: { appUrl: string }) {
  const t = await getMessages();
  const T = t.connect.technical;
  return (
    <details className="group mt-16 max-w-[40rem] border-t border-rule pt-6">
      <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45 motion-reduce:transition-none"
        />
        {T.summary}
      </summary>
      <dl className="mt-4">
        <Row term={T.endpoint.term}>
          <p>{T.endpoint.body}</p>
          <Snippet
            text={mcpUrl(appUrl)}
            label={t.connect.snippets.endpoint.label}
            caption={t.connect.snippets.endpoint.caption}
          />
        </Row>
        <Row term={T.key.term}>
          <p>
            {T.key.before} <Code>Authorization: Bearer &lt;key&gt;</Code>
            {T.key.middle}
            <Code>/mcp/&lt;key&gt;</Code>
            {T.key.after}
          </p>
        </Row>
        <Row term={T.bridge.term}>
          <p>
            {T.bridge.before} <Code>SINTR_URL</Code> {T.bridge.and} <Code>SINTR_TOKEN</Code>
            {T.bridge.or} <Code>{'{ "url": ..., "token": ... }'}</Code> {T.bridge.in}{" "}
            <Code>~/.config/sintr/mcp.json</Code>
            {T.bridge.after}
          </p>
          <p>
            <a href={bridgeUrl(appUrl)} download className={linkStyles}>
              {t.connect.download}
            </a>
          </p>
        </Row>
        <Row term={T.tools.term}>
          <ul className="space-y-3">
            {TOOLS.map((tool) => (
              <li key={tool.name}>
                <Code>{tool.name}</Code> {tool.description}{" "}
                <span className="text-ink-3">
                  {T.tools.needs(
                    [...(tool.needs.all ?? []), ...(tool.needs.any ?? [])].join(
                      tool.needs.any ? T.tools.or : ", ",
                    ),
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p>{T.tools.after}</p>
        </Row>
        <Row term={T.told.term}>
          <p>{T.told.body}</p>
          <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap rounded-command border border-rule bg-wash px-4 py-3.5 font-mono text-[0.75rem] leading-[1.65] text-ink-2">
            {instructions(new Set(API_TOKEN_ACCESS.read_write))}
          </pre>
        </Row>
        <Row term={T.leaves.term}>
          <p>{T.leaves.body}</p>
          <p>
            <a href={DOCS} className={linkStyles}>
              {T.leaves.guide}
            </a>
          </p>
        </Row>
      </dl>
    </details>
  );
}
