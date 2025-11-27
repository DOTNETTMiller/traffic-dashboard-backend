"""
Feature #3: Automatic Schema Learning for New Data Sources
Patent-worthy innovation: Few-shot learning infers field mappings from minimal examples
"""

import numpy as np
from typing import List, Dict, Any
from collections import defaultdict, Counter
import re

try:
    from transformers import AutoTokenizer, AutoModel
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False


class SchemaLearner:
    """
    Automatically learns to parse new state DOT APIs with minimal human input.
    Novel: Uses semantic similarity and few-shot learning for schema inference.
    """

    def __init__(self):
        self.known_fields = {
            'id': ['id', 'eventid', 'event_id', 'identifier', 'uid', 'uuid'],
            'state': ['state', 'statecode', 'state_code', 'jurisdiction'],
            'event_type': ['type', 'event_type', 'eventtype', 'category', 'classification'],
            'latitude': ['lat', 'latitude', 'y', 'northing', 'geo_lat'],
            'longitude': ['lon', 'lng', 'longitude', 'x', 'easting', 'geo_lon'],
            'timestamp': ['time', 'timestamp', 'datetime', 'created', 'updated', 'date'],
            'description': ['desc', 'description', 'summary', 'details', 'message'],
            'severity': ['severity', 'priority', 'impact', 'level'],
            'start_time': ['start', 'start_time', 'starttime', 'begin_date'],
            'end_time': ['end', 'end_time', 'endtime', 'close_date'],
            'lanes_affected': ['lanes', 'lanes_affected', 'lane_count', 'lanes_closed']
        }

        self.field_patterns = {
            'latitude': r'^-?\d+\.\d+$',  # Decimal number
            'longitude': r'^-?\d+\.\d+$',
            'timestamp': r'\d{4}[-/]\d{2}[-/]\d{2}',  # Date pattern
            'id': r'^[A-Z0-9_-]+$'  # Alphanumeric ID
        }

        self.transformers_available = TRANSFORMERS_AVAILABLE
        if self.transformers_available:
            try:
                self.tokenizer = AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2')
                self.model = AutoModel.from_pretrained('sentence-transformers/all-MiniLM-L6-v2')
            except Exception as e:
                print(f"Warning: Could not load transformers model: {e}")
                self.transformers_available = False

    def learn(self, sample_data: List[Dict[str, Any]],
             existing_mappings: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Learn field mappings from sample data.

        Args:
            sample_data: List of sample records from new API
            existing_mappings: Optional known mappings to build upon

        Returns:
            Suggested field mappings with confidence scores
        """
        if not sample_data:
            return {"mappings": {}, "confidence": {}, "field_types": {}}

        mappings = existing_mappings or {}
        confidence = {}
        field_types = {}

        # Extract all field names from samples
        all_fields = set()
        for sample in sample_data:
            all_fields.update(self._extract_field_names(sample))

        # For each target field, find best match in source data
        for target_field, aliases in self.known_fields.items():
            if target_field in mappings:
                continue  # Already mapped

            best_match = None
            best_score = 0.0

            for source_field in all_fields:
                # Calculate similarity score
                score = self._calculate_similarity(source_field, target_field, aliases)

                # Validate with sample data
                validation_score = self._validate_mapping(
                    source_field, target_field, sample_data
                )

                combined_score = 0.6 * score + 0.4 * validation_score

                if combined_score > best_score:
                    best_score = combined_score
                    best_match = source_field

            if best_match and best_score > 0.5:  # Confidence threshold
                mappings[target_field] = best_match
                confidence[target_field] = round(best_score, 3)
                field_types[target_field] = self._infer_type(best_match, sample_data)

        return {
            "mappings": mappings,
            "confidence": confidence,
            "field_types": field_types,
            "unmapped_fields": list(all_fields - set(mappings.values())),
            "coverage": round(len(mappings) / len(self.known_fields), 3)
        }

    def _extract_field_names(self, obj: Any, prefix: str = "") -> List[str]:
        """Recursively extract all field names from nested object."""
        fields = []

        if isinstance(obj, dict):
            for key, value in obj.items():
                full_key = f"{prefix}.{key}" if prefix else key
                fields.append(full_key)

                # Recurse into nested objects
                if isinstance(value, (dict, list)):
                    fields.extend(self._extract_field_names(value, full_key))

        elif isinstance(obj, list) and obj:
            # Check first item in list
            fields.extend(self._extract_field_names(obj[0], prefix))

        return fields

    def _calculate_similarity(self, source_field: str, target_field: str,
                            aliases: List[str]) -> float:
        """
        Calculate semantic similarity between source and target fields.
        Uses multiple techniques for robust matching.
        """
        source_lower = source_field.lower().split('.')[-1]  # Get leaf field name

        # Exact match
        if source_lower in [a.lower() for a in aliases]:
            return 1.0

        # Substring match
        if any(alias.lower() in source_lower or source_lower in alias.lower()
               for alias in aliases):
            return 0.8

        # Levenshtein-like similarity (simplified)
        max_similarity = 0.0
        for alias in aliases:
            alias_lower = alias.lower()
            # Common characters ratio
            common = sum(c in alias_lower for c in source_lower)
            total = max(len(source_lower), len(alias_lower))
            similarity = common / total if total > 0 else 0
            max_similarity = max(max_similarity, similarity)

        # Semantic similarity using transformers (if available)
        if self.transformers_available and max_similarity < 0.7:
            try:
                semantic_sim = self._semantic_similarity(source_field, target_field)
                max_similarity = max(max_similarity, semantic_sim)
            except:
                pass

        return max_similarity

    def _semantic_similarity(self, field1: str, field2: str) -> float:
        """Calculate semantic similarity using transformer embeddings."""
        if not self.transformers_available:
            return 0.0

        # Tokenize and encode
        inputs = self.tokenizer([field1, field2], padding=True,
                               truncation=True, return_tensors="pt")

        with torch.no_grad():
            outputs = self.model(**inputs)
            embeddings = outputs.last_hidden_state.mean(dim=1)

        # Cosine similarity
        cos_sim = torch.nn.functional.cosine_similarity(
            embeddings[0:1], embeddings[1:2]
        )

        return float(cos_sim)

    def _validate_mapping(self, source_field: str, target_field: str,
                         sample_data: List[Dict]) -> float:
        """
        Validate proposed mapping using sample data.
        Checks if values match expected patterns for target field.
        """
        if target_field not in self.field_patterns:
            return 0.5  # Neutral for fields without validation patterns

        pattern = self.field_patterns[target_field]
        matches = 0
        total = 0

        for sample in sample_data:
            value = self._get_nested_value(sample, source_field)

            if value is not None:
                total += 1
                if re.match(pattern, str(value)):
                    matches += 1

        return matches / total if total > 0 else 0.0

    def _get_nested_value(self, obj: Dict, path: str) -> Any:
        """Get value from nested object using dot notation path."""
        keys = path.split('.')
        current = obj

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            elif isinstance(current, list) and current:
                current = current[0]
                if isinstance(current, dict) and key in current:
                    current = current[key]
                else:
                    return None
            else:
                return None

        return current

    def _infer_type(self, field_name: str, sample_data: List[Dict]) -> str:
        """Infer data type of field from sample values."""
        values = []
        for sample in sample_data:
            value = self._get_nested_value(sample, field_name)
            if value is not None:
                values.append(value)

        if not values:
            return "unknown"

        # Check types
        types = Counter(type(v).__name__ for v in values)
        most_common_type = types.most_common(1)[0][0]

        # Refine for strings
        if most_common_type == "str":
            if all(re.match(r'\d{4}-\d{2}-\d{2}', str(v)) for v in values[:5]):
                return "datetime"
            elif all(re.match(r'^-?\d+\.\d+$', str(v)) for v in values[:5]):
                return "float"
            elif all(re.match(r'^\d+$', str(v)) for v in values[:5]):
                return "integer"

        return most_common_type

    def is_loaded(self) -> bool:
        """Schema learner is always available."""
        return True
