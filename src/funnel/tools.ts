/**
 * MCP tools for end-to-end funnel orchestration.
 *
 * Handles funnel strategy, funnel mapping, A/B test planning,
 * and full funnel assembly coordination.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function registerFunnelTools(server: McpServer) {
  // ── Funnel Strategy ──────────────────────────────────────

  server.tool(
    "funnel_design_strategy",
    "Design a complete ad funnel strategy based on your offer, price point, and business model. Recommends funnel type, traffic strategy, and conversion architecture.",
    {
      offer: z.string().describe("What you're selling (product/service/program)"),
      pricePoint: z.string().describe("Price or price range"),
      businessModel: z.enum([
        "ecommerce", "saas", "coaching", "agency", "course",
        "membership", "physical_product", "local_business", "info_product",
      ]).describe("Business model type"),
      avatar: z.string().describe("Target customer avatar"),
      currentMonthlyRevenue: z.string().optional().describe("Current monthly revenue (for context on scaling stage)"),
      currentCac: z.string().optional().describe("Current CAC if known"),
      targetCac: z.string().optional().describe("Target CAC"),
      averageLtv: z.string().optional().describe("Average customer LTV if known"),
      existingAssets: z.string().optional().describe("Existing landing pages, email lists, content, ads, etc."),
    },
    async (params) => {
      const funnelRecommendations: Record<string, string> = {
        ecommerce: "Recommended: Direct-to-offer funnel with retargeting cascade. Consider: Hero product → upsell → email retention.",
        saas: "Recommended: Free trial or freemium funnel. Consider: Content → trial → onboarding emails → paid conversion.",
        coaching: "Recommended: VSL/Webinar → Application → Sales Call. High-ticket requires human close.",
        agency: "Recommended: Lead magnet → Nurture → Case study → Discovery call. Focus on authority-building content.",
        course: "Recommended: Webinar/Challenge → Cart open/close. Or: Mini-course → Paid course. Or: VSL direct.",
        membership: "Recommended: Free trial or low-ticket tripwire → Membership. Focus on reducing churn, not just acquisition.",
        physical_product: "Recommended: Direct-to-offer with bundle/subscription upsells. Consider influencer/UGC creative.",
        local_business: "Recommended: Lead form → Booking → Show-up sequence. Geo-targeted, low-friction.",
        info_product: "Recommended: Lead magnet → Email sequence → VSL/Webinar → Offer stack. Multiple price points.",
      };

      const sections: string[] = [
        `# Funnel Strategy Design Brief`,
        `**Offer:** ${params.offer}`,
        `**Price:** ${params.pricePoint}`,
        `**Model:** ${params.businessModel}`,
        `**Avatar:** ${params.avatar}`,
        params.currentMonthlyRevenue ? `**Current Revenue:** ${params.currentMonthlyRevenue}` : "",
        params.currentCac ? `**Current CAC:** ${params.currentCac}` : "",
        params.targetCac ? `**Target CAC:** ${params.targetCac}` : "",
        params.averageLtv ? `**Average LTV:** ${params.averageLtv}` : "",
        params.existingAssets ? `**Existing Assets:** ${params.existingAssets}` : "",
        `\n## Model-Specific Starting Point`,
        funnelRecommendations[params.businessModel] ?? "",
        `\n## Design the Complete Funnel Strategy`,
        `\n### 1. Funnel Architecture`,
        `- Recommended funnel type and why`,
        `- Complete funnel map (traffic source → each step → conversion event)`,
        `- Expected conversion rates at each step`,
        `- Revenue math: traffic needed → leads → customers → revenue`,
        `\n### 2. Traffic Strategy`,
        `- Primary and secondary traffic sources`,
        `- Cold vs warm vs hot traffic treatment`,
        `- Budget allocation recommendation`,
        `- Audience targeting strategy`,
        `\n### 3. Conversion Architecture`,
        `- Each page/step in the funnel`,
        `- Content/copy strategy for each step`,
        `- Email/SMS touchpoints between steps`,
        `- Retargeting strategy for each drop-off point`,
        `\n### 4. Revenue Optimization`,
        `- Upsell/cross-sell strategy`,
        `- Order bump recommendations`,
        `- Backend/retention plays to maximize LTV`,
        `- Referral mechanisms`,
        `\n### 5. CAC Liquidation Plan`,
        `- Front-end offer to recover ad spend fast`,
        `- Break-even timeline projection`,
        `- Self-liquidating offer (SLO) strategy if applicable`,
        `\n### 6. Testing Roadmap`,
        `- Phase 1: Validate offer-market fit (minimum viable funnel)`,
        `- Phase 2: Optimize conversion rates at each step`,
        `- Phase 3: Scale traffic and creative`,
        `- Phase 4: Maximize LTV and backend`,
        `\n### 7. Key Metrics to Track`,
        `Focus on:`,
        `- **CAC** (cost to acquire a customer)`,
        `- **CAC:LTV ratio** (target 1:3 or better)`,
        `- **CAC liquidation speed** (days to recoup ad spend)`,
        `- **Front-end conversion rate**`,
        `- **Back-end LTV at 30/60/90 day cohorts**`,
        `- **Funnel efficiency** (revenue per dollar of ad spend)`,
        `Do NOT optimize for vanity metrics (CPC, CPM, CTR in isolation).`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Funnel Map Builder ───────────────────────────────────

  server.tool(
    "funnel_build_map",
    "Create a detailed funnel map with every page, email, ad, and automation needed — ready for implementation",
    {
      funnelType: z.enum([
        "lead_magnet", "webinar", "vsl", "challenge",
        "tripwire", "direct_offer", "application",
        "quiz", "free_trial", "product_launch",
      ]).describe("Funnel type to build"),
      offer: z.string().describe("The offer being sold"),
      steps: z.string().optional().describe("Custom steps or modifications to standard funnel"),
      includeEmails: z.boolean().optional().describe("Include email sequence specs (default true)"),
      includeAds: z.boolean().optional().describe("Include ad creative specs (default true)"),
      includeRetargeting: z.boolean().optional().describe("Include retargeting funnel (default true)"),
    },
    async (params) => {
      const withEmails = params.includeEmails !== false;
      const withAds = params.includeAds !== false;
      const withRetargeting = params.includeRetargeting !== false;

      const funnelMaps: Record<string, string[]> = {
        lead_magnet: [
          "Ad → Opt-in Page → Thank You Page → Delivery Email",
          "Nurture Sequence (5-7 emails) → Pitch Email → Sales Page",
          "Retarget: Opt-in visitors who didn't convert → Opt-in page",
          "Retarget: Opted in but didn't buy → Sales page / case study",
        ],
        webinar: [
          "Ad → Registration Page → Confirmation Page + Calendar Invite",
          "Reminder Sequence (3 emails before webinar)",
          "Webinar → Offer Presentation → Order Page",
          "Follow-up Sequence: Replay → Proof → Objections → Cart Close",
          "Retarget: Registered no-shows → Replay page",
          "Retarget: Attended but didn't buy → Testimonial/case study page",
        ],
        vsl: [
          "Ad → VSL Page (video + CTA) → Order Form",
          "Upsell Page 1 → Upsell Page 2 → Thank You",
          "Cart Abandon Sequence (3 emails)",
          "Retarget: Watched >50% but didn't buy → Testimonial ad → VSL page",
        ],
        challenge: [
          "Ad → Challenge Registration Page → Welcome Email",
          "Daily Challenge Emails (Day 1-5) + Community Access",
          "Day 5: Offer Reveal → Sales Page",
          "Post-Challenge: Cart Open/Close Sequence (5-7 emails)",
          "Retarget: Registered but didn't participate → Highlight reel",
        ],
        tripwire: [
          "Ad → Lead Magnet Opt-in → Thank You + Tripwire Offer ($7-$47)",
          "Tripwire Order Form → Upsell → Thank You",
          "Non-buyer Nurture → Core Offer Pitch",
          "Buyer Sequence → Core Offer Pitch (warm, proven buyers)",
        ],
        direct_offer: [
          "Ad → Sales Page / Product Page → Add to Cart → Checkout",
          "Upsell/Cross-sell → Order Confirmation",
          "Cart Abandon Sequence (3 emails, 1 SMS)",
          "Post-Purchase: Review request → Repurchase → Referral",
          "Retarget: Visitors → Dynamic product ads",
        ],
        application: [
          "Ad → Long-form Sales Page → Application Form",
          "Application Review → Qualified Booking Link → Sales Call",
          "Non-qualified → Downsell or Nurture",
          "No-show Sequence → Rebooking",
          "Post-Call Follow-up → Close or Objection Handling",
        ],
        quiz: [
          "Ad → Quiz Landing Page → Quiz Questions → Results Page",
          "Results Page: Personalized Recommendation + CTA",
          "Email Sequence Based on Quiz Segment",
          "Retarget: Started quiz but didn't finish → Quiz page",
          "Retarget: Finished quiz, no conversion → Segment-specific ad",
        ],
        free_trial: [
          "Ad → Free Trial Registration → Onboarding Email Sequence",
          "Day 1-7: Quick Win Emails → Feature Discovery",
          "Trial Ending: Conversion Sequence → Payment Page",
          "Non-converter: Extended trial offer or downsell",
          "Retarget: Signed up but inactive → Value demonstration",
        ],
        product_launch: [
          "Phase 1 - Prelaunch: Content → Waitlist Opt-in → Nurture",
          "Phase 2 - Pre-Pre-Launch: Story sequence → Anticipation building",
          "Phase 3 - Launch: Cart Open Email → Sales Page → Order Form",
          "Phase 4 - Open Cart: Daily emails (proof, objections, urgency)",
          "Phase 5 - Cart Close: Final 48hr escalation → Deadline",
          "Retarget: All visitors at each phase with phase-appropriate creative",
        ],
      };

      const sections: string[] = [
        `# Funnel Map: ${params.funnelType.replace(/_/g, " ").toUpperCase()}`,
        `**Offer:** ${params.offer}`,
        params.steps ? `**Custom Notes:** ${params.steps}` : "",
        `\n## Funnel Flow`,
        ...(funnelMaps[params.funnelType]?.map((step, i) => `${i + 1}. ${step}`) ?? []),
        `\n## Build the Complete Implementation Spec`,
        `For EVERY step in this funnel, provide:\n`,
        `### Pages`,
        `For each page:`,
        `- Page type and purpose`,
        `- Key sections and content requirements`,
        `- CTA and conversion goal`,
        `- Technical requirements (forms, tracking, integrations)`,
      ];

      if (withEmails) {
        sections.push(
          `\n### Email Sequences`,
          `For each email sequence:`,
          `- Number of emails and timing`,
          `- Purpose of each email in the sequence`,
          `- Subject line direction`,
          `- Key content and CTA`,
          `- Segmentation/branching logic`,
        );
      }

      if (withAds) {
        sections.push(
          `\n### Ad Creatives`,
          `For each funnel stage:`,
          `- Recommended ad formats (video, static, carousel)`,
          `- Hook and copy direction`,
          `- Audience targeting`,
          `- Budget allocation`,
        );
      }

      if (withRetargeting) {
        sections.push(
          `\n### Retargeting Funnel`,
          `For each drop-off point:`,
          `- Retargeting audience definition`,
          `- Creative strategy (what to show them)`,
          `- Frequency caps`,
          `- Exclusion rules`,
        );
      }

      sections.push(
        `\n### Tracking & Attribution`,
        `- Pixel events to fire at each step`,
        `- UTM parameter structure`,
        `- Conversion API events`,
        `- Revenue attribution method`,
      );

      return text(sections.join("\n"));
    },
  );

  // ── A/B Test Planner ─────────────────────────────────────

  server.tool(
    "funnel_ab_test_plan",
    "Design a prioritized A/B testing roadmap for funnel optimization. Uses ICE scoring to prioritize highest-impact tests.",
    {
      funnelDescription: z.string().describe("Description of the current funnel (steps, pages, conversion rates)"),
      currentMetrics: z.string().describe("Current metrics: CAC, conversion rates per step, LTV, revenue"),
      targetMetrics: z.string().describe("Target metrics you want to achieve"),
      budget: z.string().optional().describe("Monthly traffic budget for testing"),
      previousTests: z.string().optional().describe("Any previous tests and their results"),
    },
    async (params) => {
      const sections: string[] = [
        `# A/B Testing Roadmap`,
        `\n## Current State`,
        `**Funnel:** ${params.funnelDescription}`,
        `**Current Metrics:** ${params.currentMetrics}`,
        `**Target Metrics:** ${params.targetMetrics}`,
        params.budget ? `**Testing Budget:** ${params.budget}` : "",
        params.previousTests ? `**Previous Tests:** ${params.previousTests}` : "",
        `\n## Design the Testing Roadmap`,
        `\n### Prioritization Framework`,
        `Score each test using ICE:`,
        `- **Impact** (1-10): How much could this move the needle on CAC/LTV?`,
        `- **Confidence** (1-10): How confident are we it will win?`,
        `- **Ease** (1-10): How easy is it to implement and measure?`,
        `\n### Test Categories (in priority order)`,
        `\n#### 1. Offer Tests (Highest Impact)`,
        `- Price point testing`,
        `- Guarantee variations`,
        `- Bonus stack variations`,
        `- Offer framing/positioning`,
        `\n#### 2. Traffic Tests`,
        `- Audience targeting variations`,
        `- Platform testing`,
        `- Bid strategy testing`,
        `\n#### 3. Creative Tests`,
        `- Hook variations`,
        `- Ad format testing`,
        `- Body copy variations`,
        `\n#### 4. Landing Page Tests`,
        `- Headline testing`,
        `- Page layout/structure`,
        `- Social proof placement`,
        `- CTA copy and design`,
        `\n#### 5. Email/Follow-up Tests`,
        `- Subject line testing`,
        `- Send time optimization`,
        `- Sequence length/frequency`,
        `\n### For Each Test, Provide:`,
        `1. Test name and hypothesis`,
        `2. Control vs variation description`,
        `3. ICE score`,
        `4. Primary metric to measure`,
        `5. Sample size needed for significance`,
        `6. Expected duration`,
        `7. Implementation steps`,
        `\n### Testing Rules`,
        `- Only test ONE variable at a time`,
        `- Run to statistical significance (95% confidence)`,
        `- Document everything (even losing tests teach you something)`,
        `- Winners get implemented, then test the next variable`,
        `- Always test OFFERS before CREATIVE before PAGES`,
      ];

      return text(sections.join("\n"));
    },
  );

  // ── Full Funnel Assembly ─────────────────────────────────

  server.tool(
    "funnel_assemble",
    "Orchestrate full funnel assembly: coordinates ad creation, landing page setup, email sequences, and tracking — outputs a complete implementation checklist",
    {
      funnelType: z.string().describe("Type of funnel being built"),
      offer: z.string().describe("The offer"),
      avatar: z.string().describe("Target avatar"),
      budget: z.string().describe("Monthly ad budget"),
      timeline: z.string().optional().describe("Launch timeline"),
      platforms: z.array(z.enum(["meta", "google", "tiktok", "youtube", "linkedin"])).optional().describe("Ad platforms to use"),
      techStack: z.string().optional().describe("Tools/platforms being used (ClickFunnels, WordPress, Klaviyo, etc.)"),
    },
    async (params) => {
      const adPlatforms = params.platforms ?? ["meta"];

      const sections: string[] = [
        `# Full Funnel Assembly Checklist`,
        `**Funnel Type:** ${params.funnelType}`,
        `**Offer:** ${params.offer}`,
        `**Avatar:** ${params.avatar}`,
        `**Budget:** ${params.budget}/month`,
        params.timeline ? `**Timeline:** ${params.timeline}` : "",
        `**Ad Platforms:** ${adPlatforms.join(", ")}`,
        params.techStack ? `**Tech Stack:** ${params.techStack}` : "",
        `\n## Phase 1: Foundation (Week 1)`,
        `- [ ] Finalize offer stack (use \`creative_design_offer\`)`,
        `- [ ] Define avatar document with pain points, desires, objections`,
        `- [ ] Set up tracking: Meta Pixel, Conversion API, UTM structure`,
        `- [ ] Create ad account structure: naming conventions, campaign structure`,
        `\n## Phase 2: Content Creation (Week 1-2)`,
        `- [ ] Write landing page copy (use \`landing_generate_page\`)`,
        `- [ ] Generate 10+ hooks (use \`creative_generate_hooks\`)`,
        `- [ ] Write 3-5 ad copy variants (use \`creative_write_ad_copy\`)`,
        `- [ ] Create ad visuals in Canva (use \`canva_create_from_template\`)`,
        `- [ ] Write email sequences (use \`creative_write_email_sequence\`)`,
        adPlatforms.includes("meta") ? `- [ ] VSL script if applicable (use \`creative_write_vsl_script\`)` : "",
        `\n## Phase 3: Build (Week 2)`,
        `- [ ] Build landing pages`,
        `- [ ] Set up email automation`,
        `- [ ] Build order/checkout pages`,
        `- [ ] Configure payment processing`,
        `- [ ] Set up pixel events and conversion tracking`,
        `- [ ] Create thank you / confirmation pages`,
        `- [ ] Build retargeting audiences`,
        `\n## Phase 4: Launch (Week 3)`,
        `- [ ] Create campaigns (use \`meta_create_campaign\`)`,
        `- [ ] Set up ad sets with targeting (use \`meta_create_adset\`)`,
        `- [ ] Upload creatives (use \`meta_create_creative\`)`,
        `- [ ] Create ads linking everything (use \`meta_create_ad\`)`,
        `- [ ] Start with testing budget (20% of total)`,
        `- [ ] Monitor first 48 hours closely`,
        `\n## Phase 5: Optimize (Week 3-4+)`,
        `- [ ] Review performance daily (use \`report_funnel_performance\`)`,
        `- [ ] Kill underperforming ads after spend threshold`,
        `- [ ] Scale winners using CBO or bid cap`,
        `- [ ] Begin A/B testing roadmap (use \`funnel_ab_test_plan\`)`,
        `- [ ] Iterate creative every 2 weeks`,
        `\n## Phase 6: Scale (Month 2+)`,
        `- [ ] Expand to new audiences`,
        `- [ ] Test new platforms`,
        `- [ ] Build lookalike audiences from converters`,
        `- [ ] Optimize email sequences based on data`,
        `- [ ] Implement LTV-boosting backend offers`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );
}
