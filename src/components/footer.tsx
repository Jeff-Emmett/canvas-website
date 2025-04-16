import React from 'react';

export function Footer() {
  return (
    <footer style={{
      marginTop: "40px", 
      padding: "20px", 
      fontFamily: "'Recursive', sans-serif", 
      fontSize: "0.9rem", 
      color: "#666", 
      textAlign: "center", 
      maxWidth: "800px", 
      marginLeft: "auto", 
      marginRight: "auto"
    }}>
      <div className="footer-links">
        <p>Explore more of Jeff's mycelial tendrils:</p>
        <ul style={{listStyle: "none", padding: 0}}>
          <li><a href="https://draw.jeffemmett.com" style={{color: "#555", textDecoration: "underline"}}>draw.jeffemmett.com</a> - An AI-augmented art generation tool</li>
          <li><a href="https://quartz.jeffemmett.com" style={{color: "#555", textDecoration: "underline"}}>quartz.jeffemmett.com</a> - A glimpse into Jeff's Obsidian knowledge graph</li>
          <li><a href="https://jeffemmett.com/board/explainer" style={{color: "#555", textDecoration: "underline"}}>jeffemmett.com/board/explainer</a> - A board explaining how boards work</li>
        </ul>
      </div>
    </footer>
  );
}
