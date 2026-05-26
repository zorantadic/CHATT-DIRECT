import React from "react";

export default function DataNotice({ error, loading }) {
  if (loading) {
    return <div className="dataNotice warn">Loading backend data...</div>;
  }

  if (error) {
    return <div className="dataNotice bad">{error}</div>;
  }

  return null;
}
