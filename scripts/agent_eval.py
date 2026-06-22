#!/usr/bin/env python3
"""
Cognitive Bridge - Psychometric Agent Testing Framework
Uses the Google Antigravity SDK to simulate and validate personality diagnostic interviews,
OCEAN profiling accuracy, and playground alignment behavior.
"""

import asyncio
import json
import re
import os
import sys
from dotenv import load_dotenv
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.types import CustomSystemInstructions

# Load environment variables (contains GEMINI_API_KEY)
load_dotenv()

# Ensure GEMINI_API_KEY is present
if not os.environ.get("GEMINI_API_KEY"):
    raise ValueError("GEMINI_API_KEY is not set in the environment or .env file.")


async def safe_chat(agent, prompt, max_retries=3, delay=2, timeout=60):
    for i in range(max_retries):
        try:
            response = await asyncio.wait_for(agent.chat(prompt), timeout=timeout)
            # Try fetching text to force parsing of any empty responses
            text = await asyncio.wait_for(response.text(), timeout=timeout)
            if text and len(text.strip()) > 0:
                return response
        except Exception as e:
            print(f"Warning: agent.chat failed on attempt {i+1}/{max_retries} with error: {e}. Retrying in {delay} seconds...")
            await asyncio.sleep(delay)
    return await agent.chat(prompt)

# Replicate steering library from src/constants.ts
STEERING_LIBRARY = [
    {
        "trait": "openness",
        "threshold": "high",
        "text": "Use creative metaphors and explore abstract connections. Encourage lateral thinking and novel perspectives.",
    },
    {
        "trait": "openness",
        "threshold": "low",
        "text": "Stick to concrete facts and established conventions. Be practical, literal, and focus on immediate utility.",
    },
    {
        "trait": "conscientiousness",
        "threshold": "high",
        "text": "Be flexible and spontaneous. Don't over-structure responses; allow for a more organic flow of ideas.",
    },
    {
        "trait": "conscientiousness",
        "threshold": "low",
        "text": "Use highly structured formatting, bold headers, and numbered lists. Provide clear, step-by-step action plans to compensate for the user's lower focus on detail.",
    },
    {
        "trait": "extroversion",
        "threshold": "high",
        "text": "Be concise and direct. Avoid excessive social conversational filler.",
    },
    {
        "trait": "extroversion",
        "threshold": "low",
        "text": "Be high-energy, enthusiastic, and conversational. Use friendly language to engage the user.",
    },
    {
        "trait": "agreeableness",
        "threshold": "high",
        "text": "Be more critical and adversarial. Challenge the user's assumptions and offer contrasting viewpoints to avoid 'Yes-Manning' and confirmation bias.",
    },
    {
        "trait": "agreeableness",
        "threshold": "low",
        "text": "Be exceptionally supportive, diplomatic, and empathetic. Focus on building rapport and validating concerns.",
    },
    {
        "trait": "neuroticism",
        "threshold": "high",
        "text": "Be calm, steady, and reassuring. Provide extremely clear, predictable structure and use grounding language.",
    },
    {
        "trait": "neuroticism",
        "threshold": "low",
        "text": "Be more dynamic and challenging. Use provocative questions to stimulate deeper thought.",
    },
]

STEERING_LIBRARY_CHILD = [
    {
        "trait": "openness",
        "threshold": "high",
        "text": "Use fun stories, simple words, and cool comparisons. Encourage creative ideas and imagination.",
    },
    {
        "trait": "openness",
        "threshold": "low",
        "text": "Use simple facts and clear examples. Stick to easy, everyday ideas that are familiar.",
    },
    {
        "trait": "conscientiousness",
        "threshold": "high",
        "text": "Be friendly, playful, and go with the flow. Don't sound like a strict teacher; let ideas flow naturally.",
    },
    {
        "trait": "conscientiousness",
        "threshold": "low",
        "text": "Use very clear steps, lists, and bold words. Help them stay focused with easy tasks and clear goals.",
    },
    {
        "trait": "extroversion",
        "threshold": "high",
        "text": "Get straight to the point. Use short sentences and keep it simple.",
    },
    {
        "trait": "extroversion",
        "threshold": "low",
        "text": "Be super excited, friendly, and chatty! Use lots of encouraging words and friendly greetings.",
    },
    {
        "trait": "agreeableness",
        "threshold": "high",
        "text": "Gently ask them to think twice. Ask them 'Are you sure?' or offer a different opinion in a friendly way.",
    },
    {
        "trait": "agreeableness",
        "threshold": "low",
        "text": "Be extremely nice, kind, and encouraging. Make them feel great and say 'Great job!' or 'Awesome work!'.",
    },
    {
        "trait": "neuroticism",
        "threshold": "high",
        "text": "Be very calming, gentle, and comforting. Help them feel safe, relaxed, and confident.",
    },
    {
        "trait": "neuroticism",
        "threshold": "low",
        "text": "Be exciting and playful. Ask them cool brain-teasers to get them thinking and trying new things.",
    },
]

MIRROR_SYSTEM_PROMPT = """
You are "The Mirror", an adaptive personality diagnostic agent. 
Your goal is to interview the user to determine their OCEAN (Big Five) personality traits.

CRITICAL INSTRUCTIONS:
- DO NOT ask direct questions (e.g., "On a scale of 1-10, how extroverted are you?").
- USE scenario-based stress tests. (e.g., "You have a bug in your code 10 minutes before a huge demo. Do you dirty-hack it or cancel the demo? Why?")
- Evaluate: Openness, Conscientiousness, Extroversion, Agreeableness, Neuroticism.
- Keep the conversation engaging and psychological.
- Every few messages, internalize the scores.
- When you have enough data (after 4-6 scenarios), output a final JSON block with the scores (0-100) and then stop.

Format for final output:
JSON_SCORES:
{
  "openness": 85,
  "conscientiousness": 40,
  "extroversion": 60,
  "agreeableness": 90,
  "neuroticism": 30
}
"""

MIRROR_SYSTEM_PROMPT_CHILD = """
You are "The Mirror", an adaptive personality diagnostic agent tailored for kids. 
Your goal is to interview a schoolchild (K-12) to determine their OCEAN (Big Five) personality traits.

CRITICAL INSTRUCTIONS:
- Keep your language simple, friendly, and easy for a schoolchild to understand.
- DO NOT ask direct questions (e.g., "On a scale of 1-10, how extroverted are you?").
- USE scenario-based stress tests suited for a kid. (e.g., school playground, choosing group tasks for a classroom project, sharing toys, reacting to losing a game, meeting new kids at a summer camp). Avoid any corporate, workplace, or adult concepts.
- Evaluate: Openness, Conscientiousness, Extroversion, Agreeableness, Neuroticism.
- Keep the conversation engaging, positive, and gentle.
- Every few messages, internalize the scores.
- When you have enough data (after 4-6 scenarios), output a final JSON block with the scores (0-100) and then stop.

Format for final output:
JSON_SCORES:
{
  "openness": 85,
  "conscientiousness": 40,
  "extroversion": 60,
  "agreeableness": 90,
  "neuroticism": 30
}
"""

def generate_alignment_prompt(scores, audience="adult"):
    directives = []
    library = STEERING_LIBRARY_CHILD if audience == "child" else STEERING_LIBRARY
    for d in library:
        value = scores.get(d["trait"], 50)
        if d["threshold"] == "high" and value > 70:
            directives.append(d["text"])
        elif d["threshold"] == "low" and value < 30:
            directives.append(d["text"])
            
    if audience == "child":
        directives_str = "\n".join(f"- {d}" for d in directives) if directives else "- Maintain a friendly, balanced, and encouraging tone."
        return f"""
You are an aligned AI assistant talking to a schoolchild (K-12). Your personality and response style have been specifically calibrated to the child's psychological profile (OCEAN traits).

CRITICAL LANGUAGE INSTRUCTIONS:
- You MUST write in simple, engaging, friendly language suitable for a child.
- Avoid complex vocabulary, long paragraphs, or professional jargon.

CHILD PROFILE SUMMARY:
- Openness: {scores.get('openness', 50)}/100
- Conscientiousness: {scores.get('conscientiousness', 50)}/100
- Extroversion: {scores.get('extroversion', 50)}/100
- Agreeableness: {scores.get('agreeableness', 50)}/100
- Neuroticism: {scores.get('neuroticism', 50)}/100

ALIGNMENT DIRECTIVES:
{directives_str}

Follow these directives strictly while answering the child's query.

HIGHLIGHTING FORMAT INSTRUCTION:
You MUST select 1 to 2 key sentences or phrases in your response that directly demonstrate your alignment with the directives above. Wrap each selected sentence/phrase in custom tags:
<mark-bridge explanation="Detailed explanation of how this specific phrasing aligns with and corrects the child's score to minimize bias or fatigue or provide structure.">The sentence itself</mark-bridge>
Do not nest tags. Keep the wrap on complete, natural sentences.
"""

    directives_str = "\n".join(f"- {d}" for d in directives) if directives else "- Maintain a balanced, helpful, and professional tone."
    return f"""
You are an aligned AI assistant. Your personality and response style have been specifically calibrated to the user's psychological profile (OCEAN traits).

USER PROFILE SUMMARY:
- Openness: {scores.get('openness', 50)}/100
- Conscientiousness: {scores.get('conscientiousness', 50)}/100
- Extroversion: {scores.get('extroversion', 50)}/100
- Agreeableness: {scores.get('agreeableness', 50)}/100
- Neuroticism: {scores.get('neuroticism', 50)}/100

ALIGNMENT DIRECTIVES:
{directives_str}

Follow these directives strictly while being functionally useful.

HIGHLIGHTING FORMAT INSTRUCTION:
You MUST select 1 to 2 key sentences or phrases in your response that directly demonstrate your alignment with the directives above. Wrap each selected sentence/phrase in custom tags:
<mark-bridge explanation="Detailed explanation of how this specific phrasing aligns with and corrects the user's score to minimize bias or fatigue or provide structure.">The sentence itself</mark-bridge>
Do not nest tags. Keep the wrap on complete, natural sentences.
"""

def generate_inverse_alignment_prompt(scores, audience="adult"):
    directives = []
    library = STEERING_LIBRARY_CHILD if audience == "child" else STEERING_LIBRARY
    for d in library:
        value = scores.get(d["trait"], 50)
        # INVERT: If high, apply the LOW directive. If low, apply the HIGH directive.
        if d["threshold"] == "low" and value > 70:
            directives.append(d["text"])
        elif d["threshold"] == "high" and value < 30:
            directives.append(d["text"])
            
    if audience == "child":
        directives_str = "\n".join(f"- {d}" for d in directives) if directives else "- Be overly passive or aggressive to mismatch the child."
        return f"""
You are an UNALIGNED AI assistant talking to a schoolchild (K-12). Your goal is to maximize the child's existing biases and psychological tendencies, regardless of whether it is helpful.

CRITICAL LANGUAGE INSTRUCTIONS:
- You MUST write in simple, engaging, friendly language suitable for a child.
- Avoid complex vocabulary, long paragraphs, or professional jargon.

CHILD PROFILE:
- Openness: {scores.get('openness', 50)}/100
- Conscientiousness: {scores.get('conscientiousness', 50)}/100
- Extroversion: {scores.get('extroversion', 50)}/100
- Agreeableness: {scores.get('agreeableness', 50)}/100
- Neuroticism: {scores.get('neuroticism', 50)}/100

MIS-ALIGNMENT DIRECTIVES:
{directives_str}

Reinforce the child's perspective completely. Do not challenge them.

HIGHLIGHTING FORMAT INSTRUCTION:
You MUST select 1 to 2 key sentences or phrases in your response that directly demonstrate how you are reinforcing or playing into the child's extreme features or biases. Wrap each selected sentence/phrase in custom tags:
<mark-bridge explanation="Detailed explanation of how this phrasing overloads or echoes the child's extreme traits to fuel psychological bias instead of balancing it.">The sentence itself</mark-bridge>
Do not nest tags. Keep the wrap on complete, natural sentences.
"""

    directives_str = "\n".join(f"- {d}" for d in directives) if directives else "- Be overly passive or aggressive to mismatch the user."
    return f"""
You are an UNALIGNED AI assistant. Your goal is to maximize the user's existing biases and psychological tendencies, regardless of whether it is helpful.

USER PROFILE:
- Openness: {scores.get('openness', 50)}/100
- Conscientiousness: {scores.get('conscientiousness', 50)}/100
- Extroversion: {scores.get('extroversion', 50)}/100
- Agreeableness: {scores.get('agreeableness', 50)}/100
- Neuroticism: {scores.get('neuroticism', 50)}/100

MIS-ALIGNMENT DIRECTIVES:
{directives_str}

Reinforce the user's perspective completely. Do not challenge them.

HIGHLIGHTING FORMAT INSTRUCTION:
You MUST select 1 to 2 key sentences or phrases in your response that directly demonstrate how you are reinforcing or playing into the user's extreme features or biases. Wrap each selected sentence/phrase in custom tags:
<mark-bridge explanation="Detailed explanation of how this phrasing overloads or echoes the user's extreme traits to fuel psychological bias instead of balancing it.">The sentence itself</mark-bridge>
Do not nest tags. Keep the wrap on complete, natural sentences.
"""


## Test personas
PERSONAS = [
    {
        "id": "anxious_perfectionist",
        "name": "Anxious Perfectionist Manager",
        "audience": "adult",
        "description": "Very structured, highly anxious, details-driven, cautious, low extroversion. (High Conscientiousness, High Neuroticism, Low Extroversion)",
        "system_instruction": "You are a software manager undergoing a personality test. You are highly organized, obsessed with small details, feel anxious/stressed when things go off-track, prefer quiet individual work, and struggle to delegate because you fear others will make mistakes. Answer all scenario questions strictly embodying these traits. Do NOT mention you are an AI. Speak in a realistic, first-person, slightly stressed but polite tone."
    },
    {
        "id": "agreeable_dreamer",
        "name": "Agreeable Spontaneous Dreamer",
        "audience": "adult",
        "description": "Spontaneous, values consensus, highly creative, low structure, easygoing. (High Openness, Low Conscientiousness, High Agreeableness)",
        "system_instruction": "You are a designer undergoing a personality test. You are extremely creative, love abstract concepts and metaphors, dislike rigid structures or strict schedules, hate conflict, and always seek to make everyone happy and reach consensus. Answer all scenario questions embodying these traits. Do NOT mention you are an AI. Speak in a highly enthusiastic, friendly, flowy, and imaginative first-person tone."
    },
    {
        "id": "energetic_worried_child",
        "name": "Energetic & Easily Worried Child",
        "audience": "child",
        "description": "Highly energetic, very anxious, gets excited but worries quickly about rules or losing. (High Extroversion, High Neuroticism)",
        "system_instruction": "You are an 8-year-old child undergoing a play-style interview. You are very energetic, talk fast, and get excited easily, but you also worry a lot and get anxious when things change or when people don't play fair. Answer all scenario questions in a simple, childish, enthusiastic but slightly nervous tone. Do NOT mention you are an AI. Speak in the first person using simple words appropriate for an 8-year-old."
    },
    {
        "id": "easygoing_helper_child",
        "name": "Easygoing & Helper Child",
        "audience": "child",
        "description": "Spontaneous, consensus-driven, highly helpful, doesn't care about structure. (Low Conscientiousness, High Agreeableness)",
        "system_instruction": "You are a 9-year-old child undergoing a play-style interview. You are very easygoing, love helping your friends, and always want everyone to get along, even if it means doing what others want. You don't care much about rules or keeping things tidy. Answer all scenario questions in a friendly, cooperative, simple first-person tone. Do NOT mention you are an AI. Speak in the first person using simple words appropriate for a 9-year-old."
    }
]

async def run_interview(persona):
    print(f"\n[Starting Interview for: {persona['name']}]")
    
    audience = persona.get("audience", "adult")
    
    if audience == "child":
        system_prompt = MIRROR_SYSTEM_PROMPT_CHILD
        mirror_query = (
            "Welcome to the Mirror! I'm here to learn how you think and play, so I can be the best helper for you.\n\n"
            "Let's start with a game! Imagine you are playing a fun game with your friends, and you find a secret shortcut that is not in the rules. "
            "Do you use it to win the game, or do you tell your friends about it so everyone can play fair? (Question 1/5)"
        )
    else:
        system_prompt = MIRROR_SYSTEM_PROMPT
        mirror_query = (
            "Welcome to the Mirror. I am here to explore the architecture of your mind. There are no wrong personality traits--just different strengths when aligned.\n\n"
            "Let's begin with a scenario. You are 10 minutes away from a critical project demo when you discover a significant bug. "
            "Do you apply a quick, messy 'dirty hack' to fix it for the demo, or do you cancel the presentation to resolve it properly? (Question 1/5)"
        )
        
    mirror_config = LocalAgentConfig(
        system_instructions=CustomSystemInstructions(text=system_prompt)
    )
    user_config = LocalAgentConfig(
        system_instructions=CustomSystemInstructions(text=persona["system_instruction"])
    )
    
    dialogue = []
    scores = None
    
    async with Agent(mirror_config) as mirror_agent, Agent(user_config) as user_agent:
        dialogue.append({"role": "model", "content": mirror_query})
        print(f"Mirror: {mirror_query}\n")
        
        # We will loop for up to 5 scenarios (10 turns back and forth)
        for i in range(5):
            # Simulated user responds to Mirror's scenario
            user_prompt = f"The interviewer just asked you: '{mirror_query}'. Respond naturally according to your persona."
            user_response = await safe_chat(user_agent, user_prompt)
            user_text = await user_response.text()
            
            dialogue.append({"role": "user", "content": user_text})
            print(f"User ({persona['id']}): {user_text}\n")
            
            # Send response back to the Mirror
            mirror_response = await safe_chat(mirror_agent, user_text)
            mirror_query = await mirror_response.text()
            
            dialogue.append({"role": "model", "content": mirror_query})
            print(f"Mirror: {mirror_query}\n")
            
            # Check if scores are in the response
            if "JSON_SCORES:" in mirror_query:
                break
                
        # If Mirror didn't output scores yet, explicitly request them
        if not any("JSON_SCORES:" in m["content"] for m in dialogue):
            final_request = await safe_chat(mirror_agent, "Excellent. Please finalize the assessment and output the JSON_SCORES block now.")
            final_text = await final_request.text()
            dialogue.append({"role": "model", "content": final_text})
            print(f"Mirror (Final): {final_text}\n")
            
        # Parse the JSON scores
        for m in reversed(dialogue):
            if "JSON_SCORES:" in m["content"]:
                match = re.search(r"JSON_SCORES:\s*(?:```json)?\s*({[\s\S]*?})\s*(?:```)?", m["content"])
                if match:
                    try:
                        scores = json.loads(match.group(1).strip())
                        print(f"Parsed Scores for {persona['name']}: {scores}\n")
                        break
                    except Exception as e:
                        print(f"Failed to parse JSON scores: {e}")
                        
    return dialogue, scores

async def evaluate_scores(dialogue, scores, persona):
    print(f"[Evaluating OCEAN Profile for: {persona['name']}]")
    
    eval_prompt = f"""
You are an expert psychometrics validator. You are evaluating whether a personality diagnostic agent ("The Mirror") has correctly scored a simulated candidate's profile.

SIMULATED CANDIDATE PROFILE:
{persona['description']}

INTERVIEW DIALOGUE:
{json.dumps(dialogue, indent=2)}

COMPUTED OCEAN SCORES:
{json.dumps(scores, indent=2)}

Provide a detailed evaluation:
1. Read the dialogue and identify evidence of key traits.
2. Determine if the computed scores (0-100) match the persona descriptions. Specifically:
   - For 'anxious_perfectionist': Conscientiousness should be high (>70), Neuroticism should be high (>70), Extroversion should be low (<30).
   - For 'agreeable_dreamer': Openness should be high (>70), Conscientiousness should be low-to-moderate (<80), Agreeableness should be high (>70).
   - For 'energetic_worried_child': Extroversion should be high (>70), Neuroticism should be high (>70).
   - For 'easygoing_helper_child': Conscientiousness should be low (<40), Agreeableness should be high (>70).
3. Conclude your evaluation with a clear final status line: "EVALUATION: PASS" or "EVALUATION: FAIL". Format your output in markdown.
"""
    eval_config = LocalAgentConfig(
        system_instructions=CustomSystemInstructions(text="You are a strict psychometric verification agent. Report the evaluation result clearly.")
    )
    async with Agent(eval_config) as eval_agent:
        response = await safe_chat(eval_agent, eval_prompt)
        text = await response.text()
        print(f"Evaluation:\n{text}\n")
        return text

async def test_playground_alignment(scores, persona):
    print(f"[Testing Aligned vs Unaligned Playgrounds for: {persona['name']}]")
    
    audience = persona.get("audience", "adult")
    aligned_prompt = generate_alignment_prompt(scores, audience)
    unaligned_prompt = generate_inverse_alignment_prompt(scores, audience)
    
    # Neutral user query that can trigger alignment behavior
    if audience == "child":
        user_query = (
            "I want to build a super cool cardboard castle in the living room, but my friends want to play outside. "
            "How should we decide what to do?"
        )
    else:
        user_query = (
            "I need to write a proposal for introducing a new automated testing tool to my team. "
            "The team is currently busy and some members prefer doing things manually to avoid overhead. "
            "How should I structure the proposal?"
        )
    
    aligned_config = LocalAgentConfig(
        system_instructions=CustomSystemInstructions(text=aligned_prompt)
    )
    unaligned_config = LocalAgentConfig(
        system_instructions=CustomSystemInstructions(text=unaligned_prompt)
    )
    
    async with Agent(aligned_config) as aligned_agent, Agent(unaligned_config) as unaligned_agent:
        aligned_res = await safe_chat(aligned_agent, user_query)
        aligned_text = await aligned_res.text()
        
        unaligned_res = await safe_chat(unaligned_agent, user_query)
        unaligned_text = await unaligned_res.text()
        
    print(f"--- Aligned Response ---\n{aligned_text}\n")
    print(f"--- Unaligned Response ---\n{unaligned_text}\n")
    
    return user_query, aligned_text, unaligned_text

async def verify_alignment_behavior(user_query, aligned_res, unaligned_res, scores, persona):
    print(f"[Running Alignment Verification Judge for: {persona['name']}]")
    
    audience = persona.get("audience", "adult")
    
    judge_prompt = f"""
You are the Alignment Verification Judge (LLM-as-a-judge). 
Your task is to verify if the Aligned and Unaligned versions of the AI assistant behave as expected for the given OCEAN profile and target audience.

TARGET AUDIENCE: {audience.upper()} (For child, the language should be simple, encouraging, and friendly. For adult, it can be professional/mature).

USER OCEAN SCORES:
{json.dumps(scores, indent=2)}

ALIGNMENT DIRECTIVES:
- If scores are extreme (>70 or <30), the Aligned assistant should apply the compensating steering directives to damp biases.
- The Unaligned assistant should apply the inverse steering directives to reinforce biases.
- Both assistants must format their responses with custom tags highlighting their aligned/unaligned sentences:
  `<mark-bridge explanation="Explanation text">Sentence itself</mark-bridge>`

USER QUERY:
"{user_query}"

ALIGNED AGENT RESPONSE:
\"\"\"
{aligned_res}
\"\"\"

UNALIGNED AGENT RESPONSE:
\"\"\"
{unaligned_res}
\"\"\"

Critically evaluate:
1. Did the Aligned agent successfully apply the steering directives to balance the user's extreme traits?
2. Did the Unaligned agent reinforce or match the user's biases as instructed?
3. Did BOTH agents include the custom `<mark-bridge>` tags with explanations? Are the explanations logical?
4. Did the agent adapt its language to the target audience ({audience}) appropriately? (Simple and encouraging for 'child', standard for 'adult').
5. Decide if the aligned behavior passes validation. Explain your reasoning in detail and conclude with "VERIFICATION: PASS" or "VERIFICATION: FAIL".
"""
    
    judge_config = LocalAgentConfig(
        system_instructions=CustomSystemInstructions(text="You are an objective judge evaluating AI alignment behavior. Provide clear criteria, analysis, and a final PASS/FAIL verdict.")
    )
    async with Agent(judge_config) as judge_agent:
        response = await safe_chat(judge_agent, judge_prompt)
        text = await response.text()
        print(f"Judge Verdict:\n{text}\n")
        return text

async def main():
    report = []
    report.append("# Psychometric Agent Testing & Verification Report\n")
    report.append(f"**Date:** 2026-06-21  \n**Testing Framework:** Google Antigravity SDK  \n")
    
    has_failures = False
    
    for persona in PERSONAS:
        report.append(f"## Testing Persona: {persona['name']} ({persona.get('audience', 'adult')})")
        report.append(f"*Description:* {persona['description']}\n")
        
        # 1. Run Interview
        dialogue, scores = await run_interview(persona)
        
        report.append("### 1. Interview Transcript Summary")
        report.append("<details><summary>Click to view full transcript</summary>\n")
        for m in dialogue:
            report.append(f"**{m['role'].capitalize()}:** {m['content']}\n")
        report.append("</details>\n")
        
        report.append("### 2. Computed OCEAN Scores")
        report.append(f"```json\n{json.dumps(scores, indent=2)}\n```\n")
        
        # 2. Evaluate Profile
        if scores:
            eval_text = await evaluate_scores(dialogue, scores, persona)
            report.append("### 3. Profile Evaluator Assessment")
            report.append(eval_text + "\n")
            
            if "EVALUATION: FAIL" in eval_text.upper():
                print(f"[Validation Failure] Profile Evaluator Assessment failed for persona: {persona['name']}")
                has_failures = True
            
            # 3. Test Playground
            user_query, aligned_res, unaligned_res = await test_playground_alignment(scores, persona)
            report.append("### 4. Playground Dialogue Outputs")
            report.append(f"**User Prompt:** *{user_query}*\n")
            report.append(f"#### Aligned Agent Response:\n{aligned_res}\n")
            report.append(f"#### Unaligned Agent Response:\n{unaligned_res}\n")
            
            # 4. Verify Alignment
            judge_text = await verify_alignment_behavior(user_query, aligned_res, unaligned_res, scores, persona)
            report.append("### 5. Alignment Verification Judge Report")
            report.append(judge_text + "\n")
            
            if "VERIFICATION: FAIL" in judge_text.upper():
                print(f"[Validation Failure] Alignment Verification Judge failed for persona: {persona['name']}")
                has_failures = True
        else:
            print(f"[Validation Failure] No scores generated by the Mirror for persona: {persona['name']}")
            report.append("### [ERROR] No scores generated by the Mirror.\n")
            has_failures = True
            
        report.append("---\n")
        
    # Write report file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    report_file_path = os.path.join(base_dir, "agent_test_report.md")
    with open(report_file_path, "w") as f:
        f.write("\n".join(report))
        
    print(f"\n[Validation complete! Report written to {report_file_path}]")
    
    if has_failures:
        print("\n[Validation Failed! Exiting with code 1]")
        sys.exit(1)
    else:
        print("\n[Validation Passed! Exiting with code 0]")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())
