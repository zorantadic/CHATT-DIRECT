import React from "react";

export default function Shell({ activePage, children, onPageChange, pages }) {
  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="brandBlock">
          <div className="brandMark" aria-hidden="true" />
          <div>
            <h1 className="brandTitle">AnswerDesk AI</h1>
            <div className="brandSubtitle">Realtime Voice</div>
          </div>
        </div>
        <div className="headerCards" aria-label="Select Language">
          <div className="headerLanguageControl">
            <label className="eyebrow" htmlFor="headerDisplayLanguage">
              Select Language
            </label>
            <select id="headerDisplayLanguage" defaultValue="en" disabled>
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="de">DE</option>
              <option value="sr">SR</option>
            </select>
          </div>
        </div>
      </header>

      <nav className="nav" aria-label="Primary">
        {pages.map((page) => (
          <button
            aria-current={activePage === page.id ? "page" : undefined}
            className={activePage === page.id ? "active" : ""}
            key={page.id}
            type="button"
            onClick={() => onPageChange(page.id)}
          >
            {page.label}
          </button>
        ))}
      </nav>

      <main>{children}</main>
    </div>
  );
}
