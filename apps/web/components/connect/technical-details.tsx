import { API_TOKEN_ACCESS } from "@sintr/core";
import { TOOLS, instructions } from "@sintr/mcp";
import { linkStyles } from "@sintr/ui";
import type { ReactNode } from "react";
import { bridgeUrl, mcpUrl } from "@/lib/connect";
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
 * and the full text the assistant is given.
 */
export function TechnicalDetails({ appUrl }: { appUrl: string }) {
  return (
    <details className="group mt-16 max-w-[40rem] border-t border-rule pt-6">
      <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45 motion-reduce:transition-none"
        />
        Details for the technically curious
      </summary>
      <dl className="mt-4">
        <Row term="The endpoint">
          <p>
            sintr is an MCP server over Streamable HTTP. It is stateless: every request is a POST answered
            with JSON, with no session and no event stream.
          </p>
          <Snippet text={mcpUrl(appUrl)} label="the endpoint" caption="Endpoint" />
        </Row>
        <Row term="The key">
          <p>
            Send it as <Code>Authorization: Bearer &lt;key&gt;</Code>. Clients that take only an address can
            put it at the end instead (<Code>/mcp/&lt;key&gt;</Code>); the address is then a secret. The key
            is the only credential: cookies are never read there, and a browser on another site is refused.
            sintr stores only a SHA-256 hash of it.
          </p>
        </Row>
        <Row term="From a program on your computer">
          <p>
            For clients that start servers as local programs, the bridge forwards stdio to the endpoint with
            your key. It needs Node.js 20 or newer; set <Code>SINTR_URL</Code> and <Code>SINTR_TOKEN</Code>,
            or put <Code>{'{ "url": ..., "token": ... }'}</Code> in <Code>~/.config/sintr/mcp.json</Code>.
            Over plain http it talks only to this computer.
          </p>
          <p>
            <a href={bridgeUrl(appUrl)} download className={linkStyles}>
              Download sintr-mcp.mjs
            </a>
          </p>
        </Row>
        <Row term="What your assistant can do">
          <ul className="space-y-3">
            {TOOLS.map((tool) => (
              <li key={tool.name}>
                <Code>{tool.name}</Code> {tool.description}{" "}
                <span className="text-ink-3">
                  Needs{" "}
                  {[...(tool.needs.all ?? []), ...(tool.needs.any ?? [])].join(
                    tool.needs.any ? " or " : ", ",
                  )}
                  .
                </span>
              </li>
            ))}
          </ul>
          <p>A key that may only read, or only save, does not even see the other tools.</p>
        </Row>
        <Row term="What your assistant is told">
          <p>
            When it connects, it receives these instructions, from the same rules as the assistant inside
            sintr. What it saves is checked against your own words before it is kept.
          </p>
          <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap rounded-command border border-rule bg-wash px-4 py-3.5 font-mono text-[0.75rem] leading-[1.65] text-ink-2">
            {instructions(new Set(API_TOKEN_ACCESS.read_write))}
          </pre>
        </Row>
        <Row term="What leaves this diary">
          <p>
            Your assistant&apos;s provider receives what you tell it, and what sintr answers its tools: your
            recent days, an entry it opens, your therapy schedule and notes, a period&apos;s entries when it
            helps you prepare. That provider&apos;s terms apply to it. Nothing is ever sent to your therapist
            from an assistant; reports are approved and sent here.
          </p>
          <p>
            <a href={DOCS} className={linkStyles}>
              The full guide, with every client
            </a>
          </p>
        </Row>
      </dl>
    </details>
  );
}
