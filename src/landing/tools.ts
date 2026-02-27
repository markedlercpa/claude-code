/**
 * MCP tools for landing page design and optimization.
 *
 * Generates complete landing page copy and structure for opt-in pages,
 * sales pages, webinar registration, VSL pages, and thank you pages.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function registerLandingPageTools(server: McpServer) {
  // ── Landing Page Copy Generator ──────────────────────────

  server.tool(
    "landing_generate_page",
    "Generate complete landing page copy and section-by-section wireframe for any funnel page type (opt-in, sales, webinar reg, VSL, thank you)",
    {
      pageType: z.enum([
        "opt_in", "sales_page", "webinar_registration",
        "vsl_page", "thank_you", "order_form", "upsell",
        "application", "waitlist",
      ]).describe("Type of landing page"),
      offer: z.string().describe("What you're offering on this page"),
      avatar: z.string().describe("Target customer avatar"),
      cta: z.string().describe("Primary call to action (what they do on this page)"),
      headline: z.string().optional().describe("Specific headline to use (or let AI generate)"),
      socialProof: z.string().optional().describe("Testimonials, logos, numbers to include"),
      constraints: z.string().optional().describe("Brand guidelines, required elements, compliance needs"),
    },
    async (params) => {
      const pageStructures: Record<string, string> = {
        opt_in: `## Opt-In Page Structure
1. **Above the Fold**: Headline (benefit-driven) + Sub-headline + Lead magnet visual + Email form + CTA button
2. **What You'll Learn/Get**: 3-5 bullet points of value
3. **Social Proof**: Brief credibility indicator
4. **CTA Repeat**: Form repeat at bottom
Keep it SIMPLE — one goal, minimal distractions, no navigation.`,

        sales_page: `## Long-Form Sales Page Structure
1. **Pre-Head**: Call out the avatar ("Attention [avatar]...")
2. **Headline**: Big bold promise / transformation
3. **Opening Story/Hook**: Empathy + agitation
4. **Problem Amplification**: Cost of the problem
5. **Solution Introduction**: Your unique mechanism
6. **Benefits Section**: Outcome-focused bullets
7. **Offer Stack**: Core + bonuses with perceived values
8. **Social Proof Block**: Testimonials, case studies, results
9. **Price Reveal**: Anchoring → actual price → justification
10. **Guarantee**: Risk reversal
11. **CTA Block**: Primary buy button with urgency
12. **FAQ Section**: Objection handling
13. **Final CTA**: Last chance + two paths (action vs inaction)
14. **P.S.**: Recap the best reason to buy now`,

        webinar_registration: `## Webinar Registration Page Structure
1. **Headline**: What they'll discover/learn (curiosity + benefit)
2. **Sub-headline**: Date, time, and "free" positioning
3. **Host Credentials**: Photo + brief authority builder
4. **What You'll Discover**: 3-5 bullet points (curiosity-driven)
5. **Registration Form**: Name, email, button
6. **Urgency Element**: Limited spots / live-only bonuses
7. **Social Proof**: Past attendee quotes or metrics`,

        vsl_page: `## VSL Page Structure
1. **Headline**: Curiosity/benefit hook above video
2. **Video Player**: Prominent, autoplay optional
3. **Sub-headline**: One-line benefit below video
4. **CTA Button**: Below video (can be delayed/timed)
5. **Minimal copy below**: Brief bullets + social proof
Keep attention on the VIDEO — minimal distractions.`,

        thank_you: `## Thank You / Confirmation Page Structure
1. **Confirmation Message**: "You're in!" / "Check your email"
2. **Next Steps**: Clear instructions on what happens next
3. **Upsell/Tripwire**: Optional immediate offer (OTO)
4. **Engagement Ask**: Join community, follow social, book call
5. **Expectation Setting**: When they'll hear from you next`,

        order_form: `## Order Form Page Structure
1. **Order Summary**: What they're getting (recap offer stack)
2. **Testimonial Sidebar**: Social proof next to form
3. **Payment Form**: Clean, secure-feeling form
4. **Guarantee Badge**: Visual risk reversal
5. **Order Bump**: Checkbox add-on offer
6. **Security Badges**: SSL, payment processor logos
7. **FAQ**: Common purchase objections`,

        upsell: `## Upsell/OTO Page Structure
1. **Congratulations Header**: Acknowledge their purchase
2. **"Wait, your order is not complete"**: Bridge to next offer
3. **Upsell Offer**: Complementary product/upgrade
4. **Special Price**: Discounted, one-time offer
5. **Yes/No Buttons**: Clear accept or decline
Keep it FAST — they already have buying momentum.`,

        application: `## Application Page Structure
1. **Headline**: Exclusive positioning ("Apply to work with...")
2. **Who This Is For**: Qualifying criteria
3. **What You Get**: Brief program/service overview
4. **Social Proof**: Client results and credentials
5. **Application Form**: Qualifying questions
6. **Next Steps**: What happens after they apply`,

        waitlist: `## Waitlist Page Structure
1. **Headline**: Scarcity/exclusivity positioning
2. **What's Coming**: Brief preview of the offer
3. **Early Access Benefits**: What waitlist members get
4. **Email Form**: Simple opt-in
5. **Social Proof**: Interest indicators`,
      };

      const sections: string[] = [
        `# Landing Page Copy Brief: ${params.pageType.replace(/_/g, " ").toUpperCase()}`,
        `**Offer:** ${params.offer}`,
        `**Avatar:** ${params.avatar}`,
        `**CTA:** ${params.cta}`,
        params.headline ? `**Headline Direction:** ${params.headline}` : "",
        params.socialProof ? `**Social Proof Available:** ${params.socialProof}` : "",
        params.constraints ? `**Constraints:** ${params.constraints}` : "",
        `\n${pageStructures[params.pageType]}`,
        `\n## Instructions`,
        `Generate the COMPLETE page copy, section by section:`,
        `- Every headline, sub-headline, and body paragraph`,
        `- All bullet points and benefit statements`,
        `- CTA button text`,
        `- Social proof placement and copy`,
        `- Form labels and placeholder text`,
        `\n## Conversion Principles`,
        `- One page, one goal, one CTA`,
        `- Remove all navigation and external links`,
        `- Above-the-fold must communicate the core offer`,
        `- Mobile-first design (60%+ traffic is mobile)`,
        `- Load speed matters — keep it lean`,
        `- Every section must earn the scroll to the next section`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Headline Generator ───────────────────────────────────

  server.tool(
    "landing_generate_headlines",
    "Generate high-converting headline variants for landing pages using proven formulas",
    {
      offer: z.string().describe("What you're offering"),
      avatar: z.string().describe("Target audience"),
      pageType: z.enum(["opt_in", "sales", "webinar", "vsl", "advertorial"]).describe("Page type"),
      quantity: z.number().min(5).max(30).optional().describe("Number of headlines (default 10)"),
      existingHeadline: z.string().optional().describe("Current headline to improve upon"),
    },
    async (params) => {
      const count = params.quantity ?? 10;
      const sections: string[] = [
        `# Headline Generation Brief`,
        `**Offer:** ${params.offer}`,
        `**Avatar:** ${params.avatar}`,
        `**Page Type:** ${params.pageType}`,
        params.existingHeadline ? `**Current Headline:** ${params.existingHeadline}` : "",
        `\n## Generate ${count} Headlines Using These Formulas`,
        `\n1. **How To [Desired Result] Without [Pain/Objection]**`,
        `2. **[Number] [Avatar] Are Now [Getting Result] Using [Mechanism]**`,
        `3. **WARNING: Don't [Common Action] Until You [Learn This]**`,
        `4. **The [Adjective] New Way to [Result] In [Timeframe]**`,
        `5. **[Discover/Learn] How to [Result] — Even If [Objection]**`,
        `6. **Free [Resource]: [Specific Benefit]**`,
        `7. **[Result] In [Timeframe] Or [Guarantee]**`,
        `8. **Who Else Wants [Desirable Thing]?**`,
        `9. **[Authority Figure/Number] Reveal(s) [Secret/Method]**`,
        `10. **The [Number]-Step [System/Method] That [Result]**`,
        `\nFor each headline:`,
        `- The headline text (ready to use)`,
        `- Which formula it uses`,
        `- What psychological trigger it activates`,
        `- Suggested A/B test pairing`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Landing Page Audit ───────────────────────────────────

  server.tool(
    "landing_audit_page",
    "Audit landing page copy and structure against direct response best practices. Identifies conversion killers and recommends fixes.",
    {
      pageUrl: z.string().optional().describe("URL of the page to audit (if accessible)"),
      pageCopy: z.string().describe("Paste the full page copy/content to audit"),
      pageType: z.enum(["opt_in", "sales", "webinar", "vsl", "order_form"]).describe("Page type"),
      currentConversionRate: z.string().optional().describe("Current conversion rate if known"),
      trafficSource: z.string().optional().describe("Where traffic comes from (cold ads, warm email, organic, etc.)"),
    },
    async (params) => {
      const sections: string[] = [
        `# Landing Page Audit Brief`,
        `**Page Type:** ${params.pageType}`,
        params.pageUrl ? `**URL:** ${params.pageUrl}` : "",
        params.currentConversionRate ? `**Current CVR:** ${params.currentConversionRate}` : "",
        params.trafficSource ? `**Traffic Source:** ${params.trafficSource}` : "",
        `\n## Page Copy to Audit:`,
        `---`,
        params.pageCopy,
        `---`,
        `\n## Audit Against These Criteria`,
        `\n### 1. Above the Fold (First Screen)`,
        `- Is the value proposition immediately clear?`,
        `- Can you understand the offer in under 5 seconds?`,
        `- Is there a visible CTA without scrolling?`,
        `\n### 2. Headline`,
        `- Does it speak to a specific avatar?`,
        `- Does it promise a clear outcome?`,
        `- Does it create urgency or curiosity?`,
        `\n### 3. Copy Quality`,
        `- Reading level (aim for 6th-8th grade)`,
        `- Benefit-driven vs feature-driven`,
        `- Specificity (numbers, timeframes, results)`,
        `- Objection handling presence`,
        `\n### 4. Social Proof`,
        `- Are testimonials specific and credible?`,
        `- Is social proof placed near CTAs?`,
        `\n### 5. CTA`,
        `- Is there one clear CTA?`,
        `- Is it action-oriented and benefit-driven?`,
        `- Is it repeated enough throughout the page?`,
        `\n### 6. Trust & Risk Reversal`,
        `- Is there a guarantee?`,
        `- Are there trust badges/indicators?`,
        `\n### 7. Friction Analysis`,
        `- What might cause someone to bounce?`,
        `- Are there distracting links or navigation?`,
        `- Is the form length appropriate?`,
        `\n## Output`,
        `Provide:`,
        `1. Score (1-10) for each category above`,
        `2. Top 5 conversion killers (ranked by impact)`,
        `3. Specific rewrite recommendations with before/after examples`,
        `4. Quick wins (changes that take <30 min but could lift CVR significantly)`,
      ];

      return text(sections.join("\n"));
    },
  );
}
