export function Contact() {
  return (
    <main>
      <header>
        <a href="/">Jeff Emmett</a>
      </header>
      <h1>Contact</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Schedule a Meeting</h2>
        <p>Book a 30-minute meeting with me:</p>
        <iframe 
          src="https://zcal.co/i/wvI6_DQG?embed=1&embedType=iframe" 
          loading="lazy" 
          style={{
            border: 'none', 
            minWidth: '320px', 
            minHeight: '544px', 
            height: '731px', 
            width: '1096px'
          }} 
          id="zcal-invite" 
          scrolling="no"
          title="Schedule a meeting with Jeff Emmett"
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Blog</h2>
        <p>
          <a href="https://allthingsdecent.substack.com/" target="_blank" rel="noopener noreferrer">
            All Things Decent
          </a> - Researching the biggest ideas that could make the world a more decent place
        </p>
      </div>

      <div>
        <h2>Connect & Follow</h2>
        <p>
          Twitter: <a href="https://twitter.com/jeffemmett">@jeffemmett</a>
        </p>
        <p>
          BlueSky:{" "}
          <a href="https://bsky.app/profile/jeffemmett.bsky.social">
            @jeffemnmett.bsky.social
          </a>
        </p>
        <p>
          Mastodon:{" "}
          <a href="https://social.coop/@jeffemmett">@jeffemmett@social.coop</a>
        </p>
        <p>
          Email: <a href="mailto:jeffemmett (at) gmail.com">jeffemmett (at)gmail.com</a>
        </p>
        <p>
          GitHub: <a href="https://github.com/Jeff-Emmett">Jeff-Emmett</a>
        </p>
      </div>
    </main>
  )
}
