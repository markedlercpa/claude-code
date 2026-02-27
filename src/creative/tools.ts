/**
 * MCP tools for AI-powered ad creative generation.
 *
 * Covers hook writing, ad copywriting, VSL scripts, email sequences,
 * and creative strategy — all optimized for direct response funnels.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function registerCreativeTools(server: McpServer) {
  // ── Hook Generator ───────────────────────────────────────

  server.tool(
    "creative_generate_hooks",
    "Generate scroll-stopping hooks for ads. Produces pattern-interrupt, curiosity, pain, benefit, and social proof hooks tailored to your avatar and offer.",
    {
      offer: z.string().describe("What you're selling (product/service description)"),
      avatar: z.string().describe("Target customer avatar (demographics, psychographics, pain points)"),
      platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "google"]).optional().describe("Ad platform for format optimization"),
      hookTypes: z.array(z.enum([
        "pattern_interrupt", "curiosity", "pain_agitate",
        "benefit_lead", "social_proof", "controversy",
        "story_lead", "statistic", "question", "bold_claim",
      ])).optional().describe("Specific hook types to generate"),
      quantity: z.number().min(1).max(50).optional().describe("Number of hooks to generate (default 10)"),
      swipeFile: z.string().optional().describe("Reference hooks or winning ads to model after"),
    },
    async ({ offer, avatar, platform, hookTypes, quantity, swipeFile }) => {
      const count = quantity ?? 10;
      const types = hookTypes ?? [
        "pattern_interrupt", "curiosity", "pain_agitate",
        "benefit_lead", "social_proof", "story_lead",
      ];

      const sections: string[] = [
        `# Hook Generator Output`,
        `**Offer:** ${offer}`,
        `**Avatar:** ${avatar}`,
        platform ? `**Platform:** ${platform}` : "",
        `**Requested:** ${count} hooks across ${types.length} types\n`,
        `## Instructions for Claude`,
        `Generate ${count} scroll-stopping hooks using these frameworks:\n`,
      ];

      const hookFrameworks: Record<string, string> = {
        pattern_interrupt: "**Pattern Interrupt** — Say something unexpected that forces the scroll to stop. Break conventional wisdom. Use 'Wait...' or 'Stop.' openers.",
        curiosity: "**Curiosity Gap** — Open a loop the reader MUST close. Hint at a secret, method, or discovery without revealing it.",
        pain_agitate: "**Pain → Agitate** — Name the exact pain point, then twist the knife. Make them feel the cost of inaction.",
        benefit_lead: "**Benefit Lead** — Lead with the transformation or end result. Paint the 'after' picture vividly.",
        social_proof: "**Social Proof** — Lead with results, testimonials, case studies, or numbers that build instant credibility.",
        controversy: "**Controversy** — Challenge a deeply held belief in the market. Take a polarizing stance.",
        story_lead: "**Story Lead** — Open with a compelling micro-story (personal, client, or hypothetical) that mirrors the avatar's journey.",
        statistic: "**Statistic/Data** — Lead with a shocking stat, percentage, or data point that reframes the problem.",
        question: "**Question Hook** — Ask a question that the avatar can't help but answer 'yes' to, creating commitment.",
        bold_claim: "**Bold Claim** — Make a specific, audacious promise with a concrete timeframe or result.",
      };

      for (const type of types) {
        if (hookFrameworks[type]) {
          sections.push(`### ${hookFrameworks[type]}`);
        }
      }

      if (swipeFile) {
        sections.push(`\n## Reference Swipe File`);
        sections.push(`Model the tone, rhythm, and structure of these winning hooks (don't copy):`);
        sections.push(swipeFile);
      }

      sections.push(`\n## Output Format`);
      sections.push(`For each hook, provide:`);
      sections.push(`1. The hook text (ready to use as ad primary text opening or video script opening)`);
      sections.push(`2. Hook type label`);
      sections.push(`3. Emotional trigger targeted`);
      sections.push(`4. Suggested visual pairing (for video/image ads)\n`);
      sections.push(`Generate hooks that are specific to this offer and avatar — no generic filler.`);

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Ad Copy Writer ───────────────────────────────────────

  server.tool(
    "creative_write_ad_copy",
    "Write complete ad copy (primary text, headlines, descriptions) for Meta, Google, or other platforms. Optimized for direct response.",
    {
      offer: z.string().describe("What you're selling"),
      avatar: z.string().describe("Target customer avatar"),
      platform: z.enum(["facebook", "instagram", "google_search", "google_display", "youtube", "tiktok", "linkedin"]).describe("Ad platform"),
      objective: z.enum(["lead_generation", "purchase", "webinar_registration", "book_call", "free_trial", "content_download"]).describe("Campaign objective"),
      hook: z.string().optional().describe("Specific hook to build the ad around"),
      landingPageUrl: z.string().optional().describe("Landing page URL for the CTA"),
      tone: z.enum(["professional", "casual", "urgent", "storytelling", "educational", "provocative"]).optional().describe("Copy tone"),
      framework: z.enum(["AIDA", "PAS", "BAB", "QUEST", "4Ps", "storytelling"]).optional().describe("Copywriting framework to use"),
      variants: z.number().min(1).max(10).optional().describe("Number of copy variants (default 3)"),
      constraints: z.string().optional().describe("Character limits, compliance requirements, or other constraints"),
    },
    async (params) => {
      const count = params.variants ?? 3;
      const fw = params.framework ?? "PAS";

      const frameworkGuides: Record<string, string> = {
        AIDA: "**AIDA:** Attention → Interest → Desire → Action. Open with attention-grabbing hook, build interest with features/benefits, create desire with transformation, close with clear CTA.",
        PAS: "**PAS:** Problem → Agitate → Solution. Name the problem, agitate the pain of not solving it, present your offer as the solution.",
        BAB: "**BAB:** Before → After → Bridge. Paint the painful 'before', show the desirable 'after', position your offer as the bridge.",
        QUEST: "**QUEST:** Qualify → Understand → Educate → Stimulate → Transition. Qualify the reader, show understanding, educate on solution, stimulate desire, transition to CTA.",
        "4Ps": "**4Ps:** Promise → Picture → Proof → Push. Make a bold promise, paint the picture, provide proof, push to action.",
        storytelling: "**Story Framework:** Set the scene → Introduce conflict → Show the turning point → Reveal the resolution (your offer) → Call to action.",
      };

      const platformSpecs: Record<string, string> = {
        facebook: "Primary text: up to 125 chars visible (total 2200). Headline: 40 chars. Description: 30 chars. CTA button available.",
        instagram: "Caption: 125 chars visible (2200 total). Focus on visual-first messaging. Hashtags optional.",
        google_search: "Headlines: 3x 30 chars. Descriptions: 2x 90 chars. Display URL path: 2x 15 chars.",
        google_display: "Short headline: 30 chars. Long headline: 90 chars. Description: 90 chars. Business name: 25 chars.",
        youtube: "Title: 100 chars. Description: 5000 chars. Focus on first 2 lines (visible).",
        tiktok: "Ad text: 100 chars recommended. Keep it conversational and native to platform.",
        linkedin: "Introductory text: 150 chars visible (600 total). Headline: 70 chars. Description: 100 chars.",
      };

      const sections: string[] = [
        `# Ad Copy Brief`,
        `**Offer:** ${params.offer}`,
        `**Avatar:** ${params.avatar}`,
        `**Platform:** ${params.platform}`,
        `**Objective:** ${params.objective}`,
        `**Framework:** ${frameworkGuides[fw] ?? fw}`,
        params.tone ? `**Tone:** ${params.tone}` : "",
        params.hook ? `**Hook to build around:** ${params.hook}` : "",
        params.landingPageUrl ? `**Landing page:** ${params.landingPageUrl}` : "",
        params.constraints ? `**Constraints:** ${params.constraints}` : "",
        `\n## Platform Specs`,
        platformSpecs[params.platform] ?? "Standard digital ad format.",
        `\n## Instructions`,
        `Write ${count} distinct ad copy variants following the ${fw} framework.`,
        `\nFor each variant provide:`,
        `1. **Primary Text / Body** — The main ad copy`,
        `2. **Headline(s)** — Platform-appropriate headlines`,
        `3. **Description** — Supporting description line`,
        `4. **CTA** — Call to action text`,
        `5. **Angle** — The unique angle/perspective this variant takes`,
        `\n## Key Direct Response Principles`,
        `- Lead with the OUTCOME the avatar wants, not features`,
        `- Include specificity (numbers, timeframes, concrete results)`,
        `- Create urgency without being cheesy`,
        `- Address the #1 objection in the copy`,
        `- Write at a 6th-grade reading level`,
        `- Every line should earn the next line`,
        `- CTA should be clear, specific, and low-friction`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── VSL Script Writer ────────────────────────────────────

  server.tool(
    "creative_write_vsl_script",
    "Write a Video Sales Letter (VSL) script optimized for conversion. Covers hook, story, offer stack, close, and urgency elements.",
    {
      offer: z.string().describe("What you're selling (include price point if known)"),
      avatar: z.string().describe("Target customer avatar with pain points and desires"),
      duration: z.enum(["short_3min", "medium_8min", "long_15min", "webinar_45min"]).describe("Target video length"),
      style: z.enum(["talking_head", "slides", "animation", "hybrid", "ugc_style"]).optional().describe("Visual style"),
      offerStack: z.string().optional().describe("List of bonuses, guarantees, and offer components"),
      testimonials: z.string().optional().describe("Customer testimonials or case studies to weave in"),
      objections: z.string().optional().describe("Top objections to address in the script"),
      cta: z.string().describe("What action should the viewer take (book call, buy now, sign up, etc.)"),
    },
    async (params) => {
      const durationGuides: Record<string, string> = {
        short_3min: "3-minute VSL (~450 words). Hit hook → problem → solution → CTA fast. No fluff.",
        medium_8min: "8-minute VSL (~1200 words). Full PAS arc with story, proof, and offer stack.",
        long_15min: "15-minute VSL (~2200 words). Deep storytelling, multiple proof points, full objection handling, complete offer stack.",
        webinar_45min: "45-minute webinar/VSL (~6500 words). Full teaching framework: value upfront → pivot to offer → extended close.",
      };

      const sections: string[] = [
        `# VSL Script Brief`,
        `**Offer:** ${params.offer}`,
        `**Avatar:** ${params.avatar}`,
        `**Duration:** ${durationGuides[params.duration]}`,
        params.style ? `**Visual Style:** ${params.style}` : "",
        `**CTA:** ${params.cta}`,
        params.offerStack ? `\n**Offer Stack:**\n${params.offerStack}` : "",
        params.testimonials ? `\n**Testimonials to weave in:**\n${params.testimonials}` : "",
        params.objections ? `\n**Objections to handle:**\n${params.objections}` : "",
        `\n## VSL Structure`,
        `Write the complete script following this proven VSL framework:\n`,
        `### 1. HOOK (first 5-10 seconds)`,
        `- Pattern interrupt that stops the scroll`,
        `- Bold claim or intriguing question`,
        `- Must create enough curiosity to earn the next 30 seconds\n`,
        `### 2. PROBLEM / PAIN (agitate)`,
        `- Name the specific pain the avatar is experiencing`,
        `- Show you understand their situation deeply`,
        `- Agitate — show the cost of staying where they are\n`,
        `### 3. STORY / CREDIBILITY`,
        `- Share the origin story or discovery moment`,
        `- Establish authority and relatability`,
        `- "I was where you are..." → "Then I discovered..."\n`,
        `### 4. MECHANISM / SOLUTION`,
        `- Reveal the unique mechanism or method`,
        `- Explain WHY this works (without giving away the full HOW)`,
        `- Differentiate from everything else they've tried\n`,
        `### 5. PROOF`,
        `- Results, testimonials, case studies`,
        `- Specific numbers and timeframes`,
        `- "Don't take my word for it..."\n`,
        `### 6. OFFER STACK`,
        `- Present the core offer`,
        `- Stack bonuses one by one (build value)`,
        `- Show total value vs. price`,
        `- Guarantee that reverses risk\n`,
        `### 7. CLOSE / CTA`,
        `- Recap the transformation`,
        `- Create urgency (real scarcity or deadline)`,
        `- Clear, specific CTA: "${params.cta}"`,
        `- Paint the two paths: action vs. inaction\n`,
        `### 8. FAQ / OBJECTION HANDLING`,
        `- Address top 3-5 objections`,
        `- Reframe each as a reason TO buy\n`,
        `## Output Format`,
        `Provide the complete script with:`,
        `- [VISUAL] cues for what's on screen`,
        `- [SPEAKER] dialogue — written for natural speech, not reading`,
        `- [TEXT OVERLAY] for key points`,
        `- [B-ROLL] suggestions`,
        `- Approximate timestamps for each section`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Email Sequence Writer ────────────────────────────────

  server.tool(
    "creative_write_email_sequence",
    "Write a conversion-focused email sequence for nurture, launch, cart-close, or onboarding flows",
    {
      offer: z.string().describe("What you're selling"),
      avatar: z.string().describe("Target customer avatar"),
      sequenceType: z.enum([
        "welcome_nurture", "launch_sequence", "cart_abandonment",
        "post_purchase", "webinar_followup", "reengagement",
      ]).describe("Type of email sequence"),
      numberOfEmails: z.number().min(1).max(14).describe("Number of emails in the sequence"),
      triggerEvent: z.string().optional().describe("What triggers this sequence (opt-in, purchase, cart abandon, etc.)"),
      offerDetails: z.string().optional().describe("Price, bonuses, deadline, guarantee details"),
    },
    async (params) => {
      const sequenceGuides: Record<string, string> = {
        welcome_nurture: "Welcome sequence: Deliver lead magnet → Build authority → Share story → Provide value → Soft pitch → Harder pitch with urgency",
        launch_sequence: "Launch sequence: Pre-launch hype → Open cart → Value/proof emails → Objection handling → Scarcity → Last chance → Cart close",
        cart_abandonment: "Cart recovery: Reminder → Address objections → Social proof → Urgency/scarcity → Final offer (discount or bonus)",
        post_purchase: "Post-purchase: Confirmation → Onboarding → Quick win → Deeper value → Upsell/cross-sell → Referral ask",
        webinar_followup: "Webinar follow-up: Replay link → Key takeaways → Proof/testimonial → Objection handling → Deadline → Final reminder",
        reengagement: "Re-engagement: Pattern interrupt → Value delivery → Updated offer → Deadline → Break-up email",
      };

      const sections: string[] = [
        `# Email Sequence Brief`,
        `**Offer:** ${params.offer}`,
        `**Avatar:** ${params.avatar}`,
        `**Sequence Type:** ${sequenceGuides[params.sequenceType]}`,
        `**Number of Emails:** ${params.numberOfEmails}`,
        params.triggerEvent ? `**Trigger:** ${params.triggerEvent}` : "",
        params.offerDetails ? `**Offer Details:** ${params.offerDetails}` : "",
        `\n## Instructions`,
        `Write ${params.numberOfEmails} emails for this ${params.sequenceType} sequence.`,
        `\nFor each email provide:`,
        `1. **Subject Line** (+ 2 A/B test variants)`,
        `2. **Preview Text** (40-90 chars)`,
        `3. **Email Body** (formatted, ready to send)`,
        `4. **CTA** (button text + link destination)`,
        `5. **Send Timing** (delay after trigger or previous email)`,
        `6. **Goal** (what this specific email is designed to accomplish)`,
        `\n## Email Copy Principles`,
        `- Subject lines: curiosity, benefit, or urgency (no clickbait)`,
        `- First line must hook — no "Hey [name], hope you're well"`,
        `- Write like a friend, not a corporation`,
        `- One CTA per email (repetition OK, but one action)`,
        `- Short paragraphs (1-3 lines max)`,
        `- Use P.S. lines — they're the second most-read part after subject`,
        `- Mobile-first formatting`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Offer Stack Designer ─────────────────────────────────

  server.tool(
    "creative_design_offer",
    "Design a compelling offer stack with bonuses, guarantees, urgency/scarcity, and price anchoring for maximum perceived value",
    {
      product: z.string().describe("Core product or service"),
      price: z.string().describe("Price point or price range"),
      avatar: z.string().describe("Target customer avatar"),
      deliveryMethod: z.string().optional().describe("How the product is delivered (digital, physical, service, coaching, etc.)"),
      existingBonuses: z.string().optional().describe("Any existing bonuses or components"),
      competitorOffers: z.string().optional().describe("What competitors are offering at similar price points"),
    },
    async (params) => {
      const sections: string[] = [
        `# Offer Stack Design Brief`,
        `**Core Product:** ${params.product}`,
        `**Price:** ${params.price}`,
        `**Avatar:** ${params.avatar}`,
        params.deliveryMethod ? `**Delivery:** ${params.deliveryMethod}` : "",
        params.existingBonuses ? `**Existing Bonuses:** ${params.existingBonuses}` : "",
        params.competitorOffers ? `**Competitor Landscape:** ${params.competitorOffers}` : "",
        `\n## Design a Complete Offer Stack`,
        `\n### 1. Core Offer Positioning`,
        `- Reframe the product as a VEHICLE for the desired transformation`,
        `- Name the unique mechanism that makes it different`,
        `- Define the specific outcome promise (with timeframe if possible)`,
        `\n### 2. Value Stack Components`,
        `Design 3-5 bonuses that:`,
        `- Each addresses a specific objection or accelerates results`,
        `- Have standalone perceived value with real dollar amounts`,
        `- Are low marginal cost to deliver`,
        `- Make the core offer more complete`,
        `\n### 3. Guarantee / Risk Reversal`,
        `Design a guarantee that:`,
        `- Goes beyond basic "money back" (be specific about conditions)`,
        `- Flips risk from buyer to seller`,
        `- Has a memorable name`,
        `\n### 4. Urgency & Scarcity`,
        `Design REAL urgency/scarcity elements:`,
        `- Deadline-based: time-limited pricing, enrollment windows`,
        `- Quantity-based: limited spots, limited inventory`,
        `- Bonus-based: fast-action bonuses, early-bird pricing`,
        `- Reason WHY there's urgency (must be believable)`,
        `\n### 5. Price Anchoring`,
        `- Total stack value vs. price (show the gap)`,
        `- Cost comparison (what they're spending now without your solution)`,
        `- ROI framing (cost of the problem vs. cost of the solution)`,
        `- Payment plan options if applicable`,
        `\n### 6. Naming`,
        `- Give the offer a compelling name`,
        `- Name each bonus and the guarantee`,
        `- Names should imply the result or create curiosity`,
        `\n## Output`,
        `Provide the complete offer stack ready for a sales page, including:`,
        `- Offer name and positioning statement`,
        `- Each component with name, description, and perceived value`,
        `- Guarantee with exact terms`,
        `- Urgency/scarcity elements with implementation plan`,
        `- Price presentation copy (anchoring → reveal → justify)`,
      ];

      return text(sections.filter(Boolean).join("\n"));
    },
  );

  // ── Urgency/Scarcity Campaign ────────────────────────────

  server.tool(
    "creative_urgency_campaign",
    "Design a multi-channel urgency/scarcity promotion campaign (countdown, limited spots, flash sale, etc.)",
    {
      offer: z.string().describe("The offer being promoted"),
      campaignType: z.enum([
        "flash_sale", "cart_close", "enrollment_window",
        "price_increase", "bonus_expiry", "seasonal",
      ]).describe("Type of urgency campaign"),
      duration: z.string().describe("How long the campaign runs (e.g. '72 hours', '7 days')"),
      channels: z.array(z.enum(["email", "ads", "sms", "social", "landing_page"])).describe("Marketing channels to use"),
      discountOrIncentive: z.string().optional().describe("Discount, bonus, or special incentive details"),
    },
    async (params) => {
      const sections: string[] = [
        `# Urgency/Scarcity Campaign Brief`,
        `**Offer:** ${params.offer}`,
        `**Campaign Type:** ${params.campaignType}`,
        `**Duration:** ${params.duration}`,
        `**Channels:** ${params.channels.join(", ")}`,
        params.discountOrIncentive ? `**Incentive:** ${params.discountOrIncentive}` : "",
        `\n## Campaign Design Instructions`,
        `Design a complete ${params.campaignType} campaign across all channels:\n`,
        `### Timeline & Touchpoints`,
        `Map out every touchpoint across the ${params.duration} window:`,
        `- Launch announcement`,
        `- Mid-campaign reminder`,
        `- Final 24 hours escalation`,
        `- Last chance / final hour`,
        `\n### Per-Channel Content`,
      ];

      for (const channel of params.channels) {
        sections.push(`\n#### ${channel.toUpperCase()}`);
        switch (channel) {
          case "email":
            sections.push(`- Subject lines for each send (with urgency progression)`);
            sections.push(`- Email body copy with countdown language`);
            sections.push(`- Specific urgency elements per email`);
            break;
          case "ads":
            sections.push(`- Ad copy variants with urgency hooks`);
            sections.push(`- Headline variations with countdown/scarcity`);
            sections.push(`- Retargeting copy for warm audiences`);
            break;
          case "sms":
            sections.push(`- Short, punchy SMS messages (160 chars)`);
            sections.push(`- Timing for each send`);
            break;
          case "social":
            sections.push(`- Organic posts with countdown elements`);
            sections.push(`- Stories/Reels content ideas`);
            sections.push(`- Comment responses for objection handling`);
            break;
          case "landing_page":
            sections.push(`- Countdown timer placement`);
            sections.push(`- Dynamic content changes as deadline approaches`);
            sections.push(`- Post-deadline behavior (redirect or waitlist)`);
            break;
        }
      }

      sections.push(`\n### Urgency Escalation Curve`);
      sections.push(`Map how urgency language intensifies over the campaign duration.`);
      sections.push(`Early: soft ("limited time") → Mid: direct ("48 hours left") → End: urgent ("closing tonight")`);
      sections.push(`\n### Compliance Notes`);
      sections.push(`Ensure all urgency/scarcity claims are REAL and legally defensible.`);

      return text(sections.join("\n"));
    },
  );

  // ── Creative Testing Strategy ────────────────────────────

  server.tool(
    "creative_testing_strategy",
    "Design a systematic creative testing plan to find winning ads. Covers hook testing, body copy testing, visual testing, and audience-creative pairing.",
    {
      offer: z.string().describe("What you're selling"),
      budget: z.string().describe("Testing budget (daily or total)"),
      platform: z.enum(["meta", "google", "tiktok", "youtube"]).describe("Primary ad platform"),
      currentWinners: z.string().optional().describe("Current winning ads/creatives if any"),
      testingPhase: z.enum(["initial_launch", "scaling", "creative_refresh"]).optional().describe("Current phase"),
    },
    async (params) => {
      const sections: string[] = [
        `# Creative Testing Strategy`,
        `**Offer:** ${params.offer}`,
        `**Budget:** ${params.budget}`,
        `**Platform:** ${params.platform}`,
        params.testingPhase ? `**Phase:** ${params.testingPhase}` : "",
        params.currentWinners ? `**Current Winners:** ${params.currentWinners}` : "",
        `\n## Design a Systematic Creative Testing Plan`,
        `\n### Phase 1: Hook Testing`,
        `- Test 5-10 different hooks with identical body copy and visuals`,
        `- Kill threshold: stop after $X or Y impressions without conversion`,
        `- Winner criteria: highest hook-to-hold rate and lowest cost-per-lead/purchase`,
        `\n### Phase 2: Body Copy Testing`,
        `- Take winning hook(s), test 3-5 body copy variations`,
        `- Test different frameworks (PAS, AIDA, story-based)`,
        `- Test different lengths`,
        `\n### Phase 3: Visual/Format Testing`,
        `- Static image vs. video vs. carousel vs. UGC`,
        `- Test different thumbnail/image styles`,
        `- Test different video lengths and editing styles`,
        `\n### Phase 4: Audience-Creative Pairing`,
        `- Test winning creatives across different audiences`,
        `- Match creative angles to audience segments`,
        `\n### Testing Framework`,
        `Provide specific:`,
        `- Campaign structure (CBO vs ABO, ad set setup)`,
        `- Budget allocation per test`,
        `- Statistical significance thresholds`,
        `- Decision criteria for scaling vs killing`,
        `- Creative iteration cadence`,
        `\n### Kill/Scale Rules`,
        `Define exact rules for:`,
        `- When to kill an ad (spend threshold without conversion)`,
        `- When to scale (consistent CAC below target for X days)`,
        `- When to refresh creative (frequency > X or declining performance)`,
      ];

      return text(sections.join("\n"));
    },
  );
}
