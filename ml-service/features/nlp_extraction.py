"""
Feature #8: Natural Language Event Extraction from Unstructured Sources
Patent-worthy innovation: Extracts structured traffic events from social media,
511 texts, news, police scanners
"""

import re
from typing import List, Dict, Any
from datetime import datetime
import json

try:
    from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False


class NLPExtractor:
    """
    Extracts structured events from unstructured text.
    Novel: Early incident detection from social sources before official reports.
    """

    def __init__(self):
        self.ner_pipeline = None

        # Load NER model if available
        if TRANSFORMERS_AVAILABLE:
            try:
                self.ner_pipeline = pipeline(
                    "ner",
                    model="dslim/bert-base-NER",
                    aggregation_strategy="simple"
                )
            except:
                pass

        # Event type patterns
        self.event_patterns = {
            'incident': [
                r'(crash|accident|collision|wreck|pile-up|overturned)',
                r'(jackknif\w+|rollover)',
                r'(vehicle fire|car fire)',
                r'(disabled vehicle|broken down)',
                r'(spill|debris|hazard in road)'
            ],
            'closure': [
                r'(closed|shut down|blocked|impassable)',
                r'(road closed|highway closed|interstate closed)',
                r'(all lanes blocked|completely blocked)'
            ],
            'construction': [
                r'(construction|roadwork|paving|resurfacing)',
                r'(lane closure|shoulder work)',
                r'(bridge work|maintenance)'
            ],
            'weather': [
                r'(snow|ice|icy|slick|slippery)',
                r'(flooding|flooded|high water)',
                r'(heavy rain|downpour|storm)',
                r'(fog|low visibility|zero visibility)',
                r'(wind|gusts|high winds)'
            ]
        }

        # Location patterns
        self.location_patterns = [
            r'(I-\d+|Interstate \d+)',
            r'(US-\d+|Highway \d+|State Route \d+)',
            r'(mile marker \d+|MM \d+|MP \d+)',
            r'(exit \d+)',
            r'(near|at|between) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
        ]

        # State patterns
        self.state_pattern = r'\b(IA|Iowa|IL|Illinois|IN|Indiana|KS|Kansas|MN|Minnesota|NE|Nebraska|NV|Nevada|OH|Ohio|PA|Pennsylvania|UT|Utah|CA|California|NJ|New Jersey)\b'

        # Direction patterns
        self.direction_pattern = r'(north|south|east|west|N/B|S/B|E/B|W/B)bound'

    def extract(self, text_sources: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Extract structured events from text sources.

        Args:
            text_sources: List of {source, text} dictionaries

        Returns:
            Extracted events with confidence scores
        """
        events = []
        confidence_scores = []
        sources_used = []

        for source_data in text_sources:
            source = source_data.get('source', 'unknown')
            text = source_data.get('text', '')

            # Extract event from text
            extracted_events = self._extract_from_text(text, source)

            for event in extracted_events:
                # Filter low-confidence extractions
                if event['confidence'] > 0.4:
                    events.append(event['event'])
                    confidence_scores.append(event['confidence'])
                    sources_used.append(source)

        # Deduplicate similar events
        events = self._deduplicate_events(events)

        return {
            "events": events,
            "confidence": confidence_scores,
            "sources": sources_used,
            "extraction_time": datetime.now().isoformat()
        }

    def _extract_from_text(self, text: str, source: str) -> List[Dict]:
        """Extract event(s) from single text."""
        extracted = []

        # Identify event type
        event_type = self._identify_event_type(text)
        if not event_type:
            return []

        # Extract location
        location_info = self._extract_location(text)

        # Extract severity indicators
        severity = self._extract_severity(text)

        # Extract temporal info
        timestamp = datetime.now().isoformat()  # Default to now

        # Extract entities using NER if available
        entities = {}
        if self.ner_pipeline:
            try:
                ner_results = self.ner_pipeline(text)
                entities = self._process_ner_results(ner_results)
            except:
                pass

        # Calculate confidence
        confidence = self._calculate_confidence(
            text, event_type, location_info, severity, entities
        )

        # Build event object
        event = {
            "id": f"nlp_{hash(text)% 1000000}",
            "source": f"nlp_extraction_{source}",
            "event_type": event_type,
            "description": text[:200],  # Truncate
            "timestamp": timestamp,
            "severity": severity,
            **location_info,
            "extracted_entities": entities,
            "raw_text": text
        }

        extracted.append({
            "event": event,
            "confidence": confidence
        })

        return extracted

    def _identify_event_type(self, text: str) -> str:
        """Identify event type from text patterns."""
        text_lower = text.lower()

        type_scores = {}
        for event_type, patterns in self.event_patterns.items():
            score = sum(1 for pattern in patterns if re.search(pattern, text_lower))
            if score > 0:
                type_scores[event_type] = score

        if type_scores:
            return max(type_scores, key=type_scores.get)

        return None

    def _extract_location(self, text: str) -> Dict[str, Any]:
        """Extract location information from text."""
        location = {}

        # Extract highway
        highway_match = re.search(r'(I-\d+|US-\d+|SR-\d+)', text, re.I)
        if highway_match:
            location['highway'] = highway_match.group(1)

        # Extract mile marker
        mile_match = re.search(r'(mile marker|MM|MP)\s+(\d+)', text, re.I)
        if mile_match:
            location['mile_marker'] = int(mile_match.group(2))

        # Extract direction
        direction_match = re.search(self.direction_pattern, text, re.I)
        if direction_match:
            location['direction'] = direction_match.group(1)

        # Extract state
        state_match = re.search(self.state_pattern, text, re.I)
        if state_match:
            state_text = state_match.group(1)
            location['state'] = self._normalize_state(state_text)

        # Geocode location (simplified - would use actual geocoding in production)
        if location.get('highway') and location.get('state'):
            coords = self._estimate_coordinates(
                location['highway'],
                location.get('mile_marker', 0),
                location['state']
            )
            location['latitude'] = coords[0]
            location['longitude'] = coords[1]

        return location

    def _extract_severity(self, text: str) -> str:
        """Extract severity from text indicators."""
        text_lower = text.lower()

        high_indicators = ['fatal', 'serious', 'critical', 'major', 'all lanes',
                          'completely blocked', 'closed', 'shut down']
        medium_indicators = ['injury', 'moderate', 'lane blocked', 'delays']
        low_indicators = ['minor', 'cleared', 'shoulder']

        if any(ind in text_lower for ind in high_indicators):
            return 'high'
        elif any(ind in text_lower for ind in medium_indicators):
            return 'medium'
        elif any(ind in text_lower for ind in low_indicators):
            return 'low'

        return 'medium'  # Default

    def _process_ner_results(self, ner_results: List[Dict]) -> Dict:
        """Process NER pipeline results into structured entities."""
        entities = {
            'locations': [],
            'organizations': [],
            'times': []
        }

        for entity in ner_results:
            entity_type = entity.get('entity_group', '')
            entity_text = entity.get('word', '')

            if entity_type == 'LOC':
                entities['locations'].append(entity_text)
            elif entity_type == 'ORG':
                entities['organizations'].append(entity_text)
            elif entity_type == 'TIME':
                entities['times'].append(entity_text)

        return entities

    def _calculate_confidence(self, text: str, event_type: str,
                             location: Dict, severity: str, entities: Dict) -> float:
        """
        Calculate confidence in extracted event.
        Novel: Multi-factor confidence scoring for filtering false positives.
        """
        confidence = 0.5  # Base confidence

        # Boost for clear event type match
        if event_type:
            confidence += 0.2

        # Boost for specific location
        if location.get('highway') and location.get('state'):
            confidence += 0.15

        if location.get('mile_marker'):
            confidence += 0.05

        # Boost for coordinates
        if location.get('latitude'):
            confidence += 0.1

        # Boost for timestamp
        if entities.get('times'):
            confidence += 0.05

        # Penalty for vague text
        if len(text.split()) < 10:
            confidence -= 0.1

        # Penalty for questions (not statements)
        if '?' in text:
            confidence -= 0.2

        return min(max(confidence, 0.0), 1.0)

    def _normalize_state(self, state_text: str) -> str:
        """Normalize state name to 2-letter code."""
        state_map = {
            'iowa': 'IA', 'illinois': 'IL', 'indiana': 'IN', 'kansas': 'KS',
            'minnesota': 'MN', 'nebraska': 'NE', 'nevada': 'NV', 'ohio': 'OH',
            'pennsylvania': 'PA', 'utah': 'UT', 'california': 'CA', 'new jersey': 'NJ'
        }

        state_lower = state_text.lower()
        if len(state_text) == 2:
            return state_text.upper()

        return state_map.get(state_lower, state_text.upper())

    def _estimate_coordinates(self, highway: str, mile_marker: int,
                             state: str) -> tuple:
        """
        Estimate coordinates from highway and mile marker.
        Simplified - would use actual highway geometry in production.
        """
        # State centroids (approximate)
        state_coords = {
            'IA': (42.0, -93.5),
            'IL': (40.0, -89.0),
            'IN': (40.0, -86.0),
            'OH': (40.5, -82.5),
            'NE': (41.5, -100.0),
            'KS': (38.5, -98.0),
            'MN': (46.0, -94.5),
            'NV': (39.0, -117.0),
            'PA': (41.0, -77.5),
            'UT': (39.5, -111.5),
            'CA': (37.0, -120.0),
            'NJ': (40.0, -74.5)
        }

        base_coords = state_coords.get(state, (40.0, -95.0))

        # Offset based on mile marker (very simplified)
        lat_offset = (mile_marker - 100) * 0.01
        lon_offset = (mile_marker - 100) * 0.01

        return (base_coords[0] + lat_offset, base_coords[1] + lon_offset)

    def _deduplicate_events(self, events: List[Dict]) -> List[Dict]:
        """Remove duplicate events from multiple sources."""
        seen = set()
        unique = []

        for event in events:
            # Create signature for deduplication
            signature = (
                event.get('highway', ''),
                event.get('state', ''),
                event.get('event_type', ''),
                round(event.get('latitude', 0), 2),
                round(event.get('longitude', 0), 2)
            )

            if signature not in seen:
                seen.add(signature)
                unique.append(event)

        return unique

    def is_loaded(self) -> bool:
        """NLP extractor always available (fallback to regex)."""
        return True
