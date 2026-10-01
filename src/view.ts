export const view = `
<div class="shell">
  <header class="masthead">
    <a class="brand" href="./" aria-label="Screecher, home">
      <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="38" height="38" rx="12" class="brand-mark-bg"/>
        <path d="M11 13.5c0-1.4 1.1-2.5 2.5-2.5h5c4.7 0 8.5 3.8 8.5 8.5v0c0 4.7-3.8 8.5-8.5 8.5H15l-4 3.5v-18Z" class="brand-mark-body"/>
        <circle cx="18" cy="17.5" r="1.8" class="brand-mark-eye"/>
        <path d="M27 17.5l5-1.5-5 4.5" class="brand-mark-beak"/>
        <path d="M31.5 9.5a8 8 0 0 1 2.5 4.5M30 6.5a12 12 0 0 1 4.5 5" class="brand-mark-wave"/>
      </svg>
      <span class="brand-name">Screecher</span>
    </a>
    <p class="tagline">Send a whole link to a nearby device&nbsp;&mdash; by&nbsp;sound.</p>
  </header>
  <main class="device">
    <div class="device-top" aria-hidden="true"><span class="grille"></span><span class="device-label">chirp&middot;box</span><span class="led"></span></div>
    <div class="modes" role="tablist" aria-label="Mode">
      <button id="transmit-tab" class="mode-tab active" type="button" role="tab" aria-selected="true" aria-controls="transmit-panel">
        <svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" class="stroke"/></svg><span>Send</span>
      </button>
      <button id="receive-tab" class="mode-tab" type="button" role="tab" aria-selected="false" aria-controls="receive-panel">
        <svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3M9 20.5h6" class="stroke"/></svg><span>Receive</span>
      </button>
    </div>
    <section id="transmit-panel" class="panel" role="tabpanel" aria-labelledby="transmit-tab">
      <form id="send-form" class="send-form">
        <label for="url" class="field-label">Link to send</label>
        <input id="url" name="url" type="url" required inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="https://example.com/anything" />
        <div class="actions">
          <button id="share" class="btn btn-primary" type="submit"><svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12h2.5M7.5 8v8M11 5v14M14.5 8.5v7M18 10.5v3M21 12h0" /></svg><span id="share-label">Share with a chirp</span></button>
          <button id="cancel" class="btn btn-ghost hidden" type="button">Stop chirping</button>
        </div>
      </form>
      <div class="scope" aria-hidden="true">
        <svg class="scope-wave" viewBox="0 0 240 48" preserveAspectRatio="none" focusable="false">
          <rect x="3" y="21" width="4" height="6" rx="2"/><rect x="13" y="19" width="4" height="10" rx="2"/><rect x="23" y="16" width="4" height="16" rx="2"/><rect x="33" y="12" width="4" height="24" rx="2"/><rect x="43" y="17" width="4" height="14" rx="2"/><rect x="53" y="9" width="4" height="30" rx="2"/><rect x="63" y="14" width="4" height="20" rx="2"/><rect x="73" y="6" width="4" height="36" rx="2"/><rect x="83" y="18" width="4" height="12" rx="2"/><rect x="93" y="11" width="4" height="26" rx="2"/><rect x="103" y="4" width="4" height="40" rx="2"/><rect x="113" y="15" width="4" height="18" rx="2"/><rect x="123" y="4" width="4" height="40" rx="2"/><rect x="133" y="11" width="4" height="26" rx="2"/><rect x="143" y="18" width="4" height="12" rx="2"/><rect x="153" y="6" width="4" height="36" rx="2"/><rect x="163" y="14" width="4" height="20" rx="2"/><rect x="173" y="9" width="4" height="30" rx="2"/><rect x="183" y="17" width="4" height="14" rx="2"/><rect x="193" y="12" width="4" height="24" rx="2"/><rect x="203" y="16" width="4" height="16" rx="2"/><rect x="213" y="19" width="4" height="10" rx="2"/><rect x="223" y="21" width="4" height="6" rx="2"/><rect x="233" y="22" width="4" height="4" rx="2"/>
        </svg>
      </div>
      <div id="send-status" class="status" role="status" aria-live="polite">Ready when you are</div>
      <p id="packet-info" class="packet-info"></p>
      <p class="hint">The full link travels by sound. Keep devices close and the sender&rsquo;s volume up. Share again any time to repeat it.</p>
    </section>
    <section id="receive-panel" class="panel hidden" role="tabpanel" aria-labelledby="receive-tab">
      <button id="listen" class="btn btn-listen" type="button"><svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="3.5" width="6" height="11" rx="3" class="fill"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3M9 20.5h6"/></svg><span id="listen-label">Start listening</span></button>
      <div id="receive-status" class="status" role="status" aria-live="polite">Microphone is off</div>
      <p class="hint">Needs microphone permission. Keep this page open and the screen awake &mdash; it keeps catching links until you stop. Links never open on their own.</p>
      <div class="inbox-head"><h2 id="inbox-title" class="inbox-title">Heard links</h2><span class="counter"><span id="count">00</span><span class="visually-hidden"> received</span></span></div>
      <div id="inbox" class="inbox" aria-labelledby="inbox-title"><div class="empty"><svg class="empty-icon" viewBox="0 0 48 24" aria-hidden="true" focusable="false"><path d="M2 12h8l3-6 4 12 4-14 4 16 4-12 3 4h14"/></svg><span>Nothing heard yet. Caught links land here &mdash; tap one when you&rsquo;re ready to open it.</span></div></div>
    </section>
  </main>
  <footer class="footnote"><p>Anyone within earshot can hear a chirp, so skip secrets.</p><p><a href="https://github.com/lcabraja/schreecher">Source on GitHub</a></p></footer>
</div>
`;
