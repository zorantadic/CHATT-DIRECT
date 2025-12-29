import { useEffect, useState } from "react";

const BACKEND_HTTP = "http://127.0.0.1:50505";

type Props = {
  onBack: () => void;
};

type InstructionsResp = {
  current: string;
  default: string;
  updatedAt: string;
};

type Profile = {
  id: string;
  name: string;
  description: string;
  speechBehavior?: string[];
  contentInstructions: string[];
};

type ProfilesResp = {
  styles: Profile[];
  domains: Profile[];
};

const FIXED_RULES =
`RULES:
Answer only the provided question.
Do not ask questions.
Do not introduce new topics.`;

export default function InstructionsPage({ onBack }: Props) {
  const [current, setCurrent] = useState("");
  const [def, setDef] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const [profiles, setProfiles] = useState<ProfilesResp>({ styles: [], domains: [] });
  const [profilesError, setProfilesError] = useState<string>("");

  const loadInstructions = async () => {
    const r = await fetch(`${BACKEND_HTTP}/v1/instructions`);
    const d = (await r.json()) as InstructionsResp;
    setCurrent(d.current ?? "");
    setDef(d.default ?? "");
    setUpdatedAt(d.updatedAt ?? "");
  };

  const loadProfiles = async () => {
    try {
      const r = await fetch(`${BACKEND_HTTP}/instruction_profiles.json?t=${Date.now()}`);
      if (!r.ok) {
        setProfiles({ styles: [], domains: [] });
        setProfilesError(`Profiles not loaded (HTTP ${r.status}). Check backend serves /instruction_profiles.json`);
        return;
      }
      const d = (await r.json()) as ProfilesResp;

      setProfiles({
        styles: Array.isArray(d.styles) ? d.styles : [],
        domains: Array.isArray(d.domains) ? d.domains : []
      });
      setProfilesError("");
    } catch (e) {
      setProfiles({ styles: [], domains: [] });
      setProfilesError("Profiles not loaded (network error). Check backend is running on 50505.");
    }
  };

  const save = async () => {
    await fetch(`${BACKEND_HTTP}/v1/instructions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current })
    });
    await loadInstructions();
  };

  const reset = async () => {
    await fetch(`${BACKEND_HTTP}/v1/instructions/reset`, { method: "POST" });
    await loadInstructions();
  };

  const extractDomainBlock = (text: string): string | null => {
    const parts = text.split("\n---\n");
    const domainCandidate = parts.find((b, idx) => idx === 2 && b.startsWith("CONTENT INSTRUCTIONS:"));
    return domainCandidate ?? null;
  };

  const extractRulesBlock = (text: string): string => {
    const parts = text.split("\n---\n");
    const rules = parts.find((b) => b.startsWith("RULES:"));
    return rules ?? FIXED_RULES;
  };

  const applyStyle = (p: Profile) => {
    const speech = (p.speechBehavior ?? []).join("\n").trim();
    const styleContent = (p.contentInstructions ?? []).join("\n").trim();

    const domainBlock = extractDomainBlock(current);
    const rulesBlock = extractRulesBlock(current);

    const next =
`SPEECH BEHAVIOR:
${speech}

---
CONTENT INSTRUCTIONS:
${styleContent}
${domainBlock ? "\n---\n" + domainBlock : ""}

---
${rulesBlock}`;

    setCurrent(next);
  };

  const applyDomain = (p: Profile) => {
    const parts = current.split("\n---\n");
    const rulesBlock = extractRulesBlock(current);

    const speechBlock = parts.find((b) => b.startsWith("SPEECH BEHAVIOR:")) ?? "SPEECH BEHAVIOR:\n";
    const styleBlock = parts.find((b, idx) => idx === 1 && b.startsWith("CONTENT INSTRUCTIONS:")) ?? "CONTENT INSTRUCTIONS:\n";

    const domain =
`CONTENT INSTRUCTIONS:
${(p.contentInstructions ?? []).join("\n").trim()}`;

    const next =
`${speechBlock}

---
${styleBlock}

---
${domain}

---
${rulesBlock}`;

    setCurrent(next);
  };

  useEffect(() => {
    loadInstructions();
    loadProfiles();
  }, []);

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Instructions</h2>
      <button onClick={onBack}>Back to Voice Chat</button>

      <h3>Current Instructions</h3>
      <textarea
        rows={14}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        style={{ width: "100%", fontFamily: "monospace" }}
      />
      <div style={{ fontSize: 12 }}>updatedAt: {updatedAt}</div>
      <button onClick={save}>Save</button>
      <button onClick={reset}>Reset to Default</button>

      <h3>Style Profiles</h3>
      {profilesError ? <div style={{ color: "crimson" }}>{profilesError}</div> : null}
      {profiles.styles?.map?.((p) => (
        <div key={p.id} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 6 }}>
          <strong>{p.name}</strong>
          <div>{p.description}</div>

          <textarea
            readOnly
            rows={6}
            value={
`SPEECH BEHAVIOR:
${(p.speechBehavior ?? []).join("\n")}

CONTENT INSTRUCTIONS:
${(p.contentInstructions ?? []).join("\n")}`
            }
            style={{ width: "100%", fontFamily: "monospace", marginTop: 6 }}
          />

          <button onClick={() => applyStyle(p)}>Apply</button>
        </div>
      ))}

      <h3>Domain Profiles</h3>
      {profiles.domains?.map?.((p) => (
        <div key={p.id} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 6 }}>
          <strong>{p.name}</strong>
          <div>{p.description}</div>

          <textarea
            readOnly
            rows={6}
            value={
`CONTENT INSTRUCTIONS:
${(p.contentInstructions ?? []).join("\n")}`
            }
            style={{ width: "100%", fontFamily: "monospace", marginTop: 6 }}
          />

          <button onClick={() => applyDomain(p)}>Apply</button>
        </div>
      ))}

      <h3>Default Instructions</h3>
      <textarea
        rows={10}
        value={def}
        readOnly
        style={{ width: "100%", fontFamily: "monospace" }}
      />
    </div>
  );
}
