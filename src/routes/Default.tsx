import './Default.css'

export function Default() {
  return (
    <main>
      <header>
        <nav className="header-links">
          <span className="explainer">Quick Links:</span>
          <a href="https://draw.jeffemmett.com" className="nav-link">🎨 Drawfast</a>
          <a href="https://jeffemmett.com/board/bsci-demo" className="nav-link">🖼️ Canvas</a>
          <a href="https://jeffemmett.com/board/mycofi" className="nav-link">🍄 MycoFi</a>
          <a href="https://quartz.jeffemmett.com" className="nav-link">📚 Knowledge Base</a>
          <a href="https://bored.jeffemmett.com" className="nav-link">🥱 Bored</a>
          <a href="https://betting.jeffemmett.com" className="nav-link">♟️ Chess Prediction Markets</a>
        </nav>
        <div className="header-content">
          <span className="site-title">Jeff Emmett's Website</span>
        </div>
      </header>
      <h2>Hey there! 👋🍄</h2>
      <p>
        My research investigates the intersection of mycelium and emancipatory
        technologies. I am interested in the potential of new convivial tooling
        as a medium for group consensus building and collective action, in order
        to empower communities of practice to address their own challenges with 
        self-provisioned infrastructure.
      </p>

      <p>
        My current focus is basic research into the nature of digital
        organisation, developing prototype toolkits to improve shared
        tooling, and applying this research to the design of new systems
        and protocols which support the self-organisation of knowledge and
        emergent response to local needs.
      </p>

      <h2>My work</h2>
      <p>
        Alongside my independent work, I am a researcher and engineering
        communicator at <a href="https://block.science/">Block Science</a>, an
        advisor to the Active Inference Lab, Commons Stack, and the Trusted
        Seed. I am also an occasional collaborator with{" "}
        <a href="https://economicspace.agency/">ECSA</a>.
      </p>

      <h2>Get in touch</h2>
      <p>
        I am on Twitter <a href="https://twitter.com/jeffemmett">@jeffemmett</a>
        , Mastodon{" "}
        <a href="https://social.coop/@jeffemmett">@jeffemmett@social.coop</a>{" "}
        and GitHub <a href="https://github.com/Jeff-Emmett">@Jeff-Emmett</a>.
      </p>

      <span className="dinkus">***</span>

      <div className="quicklinks">
        <h3>Active Projects</h3>
        <ul>
          <li><a href="https://draw.jeffemmett.com">🎨 Drawfast</a> - AI sketching tool</li>
          <li><a href="https://jeffemmett.com/board/bsci-demo">📊 Canvas</a> - Collaborative whiteboards</li>
          <li><a href="https://jeffemmett.com/board/mycofi">🍄 MycoFi</a> - Mycelial design patterns</li>
          <li><a href="https://quartz.jeffemmett.com">📚 Knowledge Base</a> - Obsidian second brain</li>
          <li><a href="https://bored.jeffemmett.com">🥱 Bored</a> - Boredom exploration</li>
          <li><a href="https://betting.jeffemmett.com">♟️ Chess Prediction Markets</a> - Chess prediction markets</li>
        </ul>
      </div>

      <h2>Talks</h2>
      <ol>
        <li>
          <a href="https://www.teamhuman.fm/episodes/238-jeff-emmett">
            MycoPunk Futures on Team Human with Douglas Rushkoff
          </a>{" "}
          (<a href="artifact/tft-rocks-integration-domain.pdf">slides</a>)
        </li>
        <li>
          <a href="https://www.youtube.com/watch?v=AFJFDajuCSg">
            Exploring MycoFi on the Greenpill Network with Kevin Owocki
          </a>{" "}
          (<a href="artifact/tft-rocks-integration-domain.pdf">slides</a>)
        </li>
        <li>
          <a href="https://youtu.be/9ad2EJhMbZ8">
            Re-imagining Human Value on the Telos Podcast with Rieki &
            Brandonfrom SEEDS
          </a>{" "}
          (<a href="artifact/tft-rocks-integration-domain.pdf">slides</a>)
        </li>
        <li>
          <a href="https://www.youtube.com/watch?v=i8qcg7FfpLM&t=1348s">
            Move Slow & Fix Things: Design Patterns from Nature
          </a>{" "}
          (<a href="artifact/tft-rocks-integration-domain.pdf">slides</a>)
        </li>
        <li>
          <a href="https://podcasters.spotify.com/pod/show/theownershipeconomy/episodes/Episode-009---Localized-Democracy-and-Public-Goods-with-Token-Engineering--with-Jeff-Emmett-of-The-Commons-Stack--BlockScience-Labs-e1ggkqo">
            Localized Democracy and Public Goods with Token Engineering on the
            Ownership Economy
          </a>{" "}
          (<a href="artifact/tft-rocks-integration-domain.pdf">slides</a>)
        </li>
        <li>
          <a href="https://youtu.be/kxcat-XBWas">
            A Discussion on Warm Data with Nora Bateson on Systems Innovation
          </a>
        </li>
      </ol>
      <h2>Writing</h2>
      <ol>
        <li>
          <a href="https://www.mycofi.art">
            Exploring MycoFi: Mycelial Design Patterns for Web3 & Beyond
          </a>
        </li>
        <li>
          <a href="https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2021.578721/full">
            Challenges & Approaches to Scaling the Global Commons
          </a>
        </li>
        <li>
          <a href="https://allthingsdecent.substack.com/p/mycoeconomics-and-permaculture-currencies">
            From Monoculture to Permaculture Currencies: A Glimpse of the
            Myco-Economic Future
          </a>
        </li>
        <li>
          <a href="https://medium.com/good-audience/rewriting-the-story-of-human-collaboration-c33a8a4cd5b8">
            Rewriting the Story of Human Collaboration
          </a>
        </li>
      </ol>
    </main>
  )
}
