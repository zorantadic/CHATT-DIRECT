import React from "react";
import DataNotice from "../components/DataNotice.jsx";
import GlassPanel from "../components/GlassPanel.jsx";
import ReadonlyField from "../components/ReadonlyField.jsx";

function firstProvided(values, fallback) {
  return values.find((value) => value && value !== "Not provided" && value !== "Not loaded") || fallback;
}

export default function ScenariosPage({ connectionState, error, loading, scenarioState }) {
  const selected = scenarioState.selected;
  const selectedDescription = selected
    ? firstProvided(
        [selected.shortDescription, selected.recommendedUse, selected.displayDetails],
        "Scenario behavior is loaded from the backend.",
      )
    : "Scenario behavior is loaded from the backend.";
  const currentInstructions = scenarioState.instructionText || "No current instructions loaded.";
  const defaultInstructions = scenarioState.defaultInstruction || "No scenario default instructions loaded.";

  return (
    <div className="scenarioPage">
      <div className="scenarioPageHeader">
        <div>
          <h2>Scenario & Instructions</h2>
          <div className="panelSub">Choose the assistant behavior and inspect instruction state.</div>
        </div>
        <div className="scenarioHeaderBadges" aria-label="Scenario state">
          <span className="scenarioBadge scenarioBadgeBlue">{selected ? "Active scenario" : "Not loaded"}</span>
          <span className={`scenarioBadge ${scenarioState.hasCustomInstruction ? "scenarioBadgeAmber" : "scenarioBadgeGreen"}`}>
            {scenarioState.instructionOverrideLabel}
          </span>
        </div>
      </div>

      <DataNotice error={error} loading={loading} />

      <div className="scenarioLayout">
        <section className="scenarioColumn scenarioLeftColumn" aria-label="Scenario selection">
          <GlassPanel className="scenarioPanel selectedScenarioPanel">
            <div className="scenarioPanelHeader">
              <div>
                <div className="scenarioKicker">Selected Scenario</div>
                <h3>{selected?.name || "Not loaded"}</h3>
              </div>
              <div className="scenarioOrbIcon" aria-hidden="true" />
            </div>
            <p className="scenarioDescriptionText">{selectedDescription}</p>
            <div className="scenarioBadgeRow">
              <span className="scenarioBadge scenarioBadgeBlue">{selected ? "Selected / Active" : "Not loaded"}</span>
              <span className={`scenarioBadge ${scenarioState.hasCustomInstruction ? "scenarioBadgeAmber" : "scenarioBadgeGreen"}`}>
                {scenarioState.instructionOverrideLabel}
              </span>
            </div>
          </GlassPanel>

          <GlassPanel className="scenarioPanel scenarioLibraryPanel">
            <div className="scenarioPanelHeader compact">
              <div>
                <h3>Scenario Library</h3>
                <div className="scenarioHint">Read-only backend scenario list</div>
              </div>
            </div>
            <div className="scenarioCards">
              {!scenarioState.scenarios.length && (
                <div className="small">Scenario cards will load from the backend.</div>
              )}
              {scenarioState.scenarios.map((scenario) => {
                const isSelected = scenario.id === selected?.id;
                return (
                  <article className={`card scenarioCard${isSelected ? " active" : ""}`} key={scenario.id}>
                    <div className="scenarioCardIcon" aria-hidden="true" />
                    <div className="scenarioCardTitle">{scenario.name}</div>
                    <div className="scenarioCardState">{isSelected ? "Selected" : scenario.category}</div>
                    <p>{firstProvided([scenario.shortDescription, scenario.displayDetails], "No description provided.")}</p>
                  </article>
                );
              })}
            </div>
            <div className="scenarioLibraryPreview" aria-live="polite">
              <div className="scenarioPreviewTitle">Scenario Preview</div>
              <div className="scenarioPreviewMeta">Category: {selected?.category || "Not provided"}</div>
              <div className="scenarioPreviewText">
                Details: {selected ? firstProvided([selected.displayDetails, selected.shortDescription], "Not provided") : "Not provided"}
              </div>
              <div className="scenarioPreviewText">Recommended use: {selected?.recommendedUse || "Not provided"}</div>
            </div>
          </GlassPanel>

          <GlassPanel className="scenarioPanel scenarioDetailsPanel">
            <div className="scenarioPanelHeader compact">
              <div>
                <h3>Scenario Details</h3>
                <div className="scenarioHint">Human-readable metadata</div>
              </div>
            </div>
            <div className="scenarioDetailRows">
              <ReadonlyField label="Category" value={selected?.category || "Not provided"} />
              <ReadonlyField
                label="Description"
                value={selected ? firstProvided([selected.displayDetails, selected.shortDescription], "Not provided") : "Not provided"}
              />
              <ReadonlyField label="Recommended Use" value={selected?.recommendedUse || "Not provided"} />
            </div>
          </GlassPanel>
        </section>

        <section className="scenarioColumn scenarioRightColumn" aria-label="Scenario instructions">
          <GlassPanel className="scenarioPanel currentInstructionsPanel">
            <div className="scenarioPanelHeader">
              <div>
                <h3>Current Instructions</h3>
                <div className="scenarioHint">Read-only current instruction text for the selected scenario</div>
              </div>
              <span className="scenarioBadge scenarioBadgeGreen">Read-only</span>
            </div>
            <textarea className="mono" rows="18" spellCheck="false" value={currentInstructions} readOnly />
            <div className="instructionMetaLine">
              <span>
                Source: <strong>{scenarioState.instructionSource}</strong>
              </span>
              <span>
                Last updated: <strong className="mono">{selected?.userInstructionUpdatedAt || "Not provided"}</strong>
              </span>
            </div>
            <div className="instructionActions">
              <button className="scenarioPrimaryAction" type="button" disabled>
                Save Instructions
              </button>
              <button className="scenarioRefreshAction" type="button" disabled>
                Refresh Instructions
              </button>
              <button className="scenarioDangerAction" type="button" disabled>
                Reset to Scenario Default
              </button>
            </div>
            <div className="instructionStatus small" role="status" aria-live="polite">
              Scenario edit and save actions are intentionally disabled in the web UI.
            </div>
          </GlassPanel>

          <GlassPanel className="scenarioPanel defaultInstructionsPanel">
            <div className="scenarioPanelHeader">
              <div>
                <h3>Scenario Default Instructions</h3>
                <div className="scenarioHint">Base template from the selected scenario</div>
              </div>
              <span className="scenarioBadge scenarioBadgeBlue">Read-only template</span>
            </div>
            <textarea className="mono" rows="10" spellCheck="false" value={defaultInstructions} readOnly />
          </GlassPanel>

          <GlassPanel className="scenarioPanel instructionStatePanel">
            <div className="scenarioPanelHeader compact">
              <div>
                <h3>Instruction State</h3>
                <div className="scenarioHint">Passive runtime summary</div>
              </div>
            </div>
            <div className="scenarioDetailRows stateRows">
              <ReadonlyField label="Backend" value={connectionState.backendLabel} />
              <ReadonlyField
                label="Active Scenario"
                value={selected ? `${selected.name} (${selected.id})` : "Not provided"}
              />
              <ReadonlyField label="Override" value={scenarioState.instructionOverrideLabel} />
              <ReadonlyField label="Refresh" value="Requires active realtime session" />
            </div>
          </GlassPanel>
        </section>
      </div>
    </div>
  );
}
