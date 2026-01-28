#!/usr/bin/env python3
"""
YOLO Label File Validator
Validates all .txt label files in labels/train and labels/val directories
according to Ultralytics YOLO requirements.
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple, Optional
import math

class LabelValidationError:
    def __init__(self, filename: str, line_num: int, line_content: str, reason: str):
        self.filename = filename
        self.line_num = line_num
        self.line_content = line_content.strip()
        self.reason = reason
    
    def __str__(self):
        return f"{self.filename}:{self.line_num} | '{self.line_content}' | ERROR: {self.reason}"

def validate_yolo_line(line: str, line_num: int, filename: str) -> Optional[LabelValidationError]:
    """
    Validate a single YOLO label line.
    Format: class_id center_x center_y width height
    All coordinates normalized [0, 1]
    """
    line = line.strip()
    
    # Skip empty lines (YOLO allows empty label files)
    if not line:
        return None
    
    # Split into values
    parts = line.split()
    
    # Check exactly 5 values
    if len(parts) != 5:
        return LabelValidationError(
            filename, line_num, line,
            f"Expected exactly 5 values, found {len(parts)}"
        )
    
    try:
        # Parse values
        class_id_str, center_x_str, center_y_str, width_str, height_str = parts
        
        # Validate class_id (must be non-negative integer)
        try:
            class_id = int(class_id_str)
            if class_id < 0:
                return LabelValidationError(
                    filename, line_num, line,
                    f"class_id must be non-negative integer, found: {class_id}"
                )
        except ValueError:
            return LabelValidationError(
                filename, line_num, line,
                f"class_id must be integer, found: '{class_id_str}'"
            )
        
        # Parse coordinates as floats
        try:
            center_x = float(center_x_str)
            center_y = float(center_y_str)
            width = float(width_str)
            height = float(height_str)
        except ValueError as e:
            return LabelValidationError(
                filename, line_num, line,
                f"Invalid numeric value: {str(e)}"
            )
        
        # Check for NaN or Infinity
        coords = [center_x, center_y, width, height]
        for i, coord in enumerate(coords):
            if math.isnan(coord):
                coord_name = ['center_x', 'center_y', 'width', 'height'][i]
                return LabelValidationError(
                    filename, line_num, line,
                    f"{coord_name} is NaN"
                )
            if math.isinf(coord):
                coord_name = ['center_x', 'center_y', 'width', 'height'][i]
                return LabelValidationError(
                    filename, line_num, line,
                    f"{coord_name} is Infinity"
                )
        
        # Check width and height > 0
        if width <= 0:
            return LabelValidationError(
                filename, line_num, line,
                f"width must be > 0, found: {width}"
            )
        
        if height <= 0:
            return LabelValidationError(
                filename, line_num, line,
                f"height must be > 0, found: {height}"
            )
        
        # Check center coordinates are within [0, 1]
        if center_x < 0 or center_x > 1:
            return LabelValidationError(
                filename, line_num, line,
                f"center_x must be in [0, 1], found: {center_x}"
            )
        
        if center_y < 0 or center_y > 1:
            return LabelValidationError(
                filename, line_num, line,
                f"center_y must be in [0, 1], found: {center_y}"
            )
        
        # Check bounding box doesn't exceed image bounds
        # Calculate box boundaries
        x_min = center_x - width / 2
        x_max = center_x + width / 2
        y_min = center_y - height / 2
        y_max = center_y + height / 2
        
        if x_min < 0:
            return LabelValidationError(
                filename, line_num, line,
                f"Bounding box exceeds left edge: x_min={x_min:.6f} < 0"
            )
        
        if x_max > 1:
            return LabelValidationError(
                filename, line_num, line,
                f"Bounding box exceeds right edge: x_max={x_max:.6f} > 1"
            )
        
        if y_min < 0:
            return LabelValidationError(
                filename, line_num, line,
                f"Bounding box exceeds top edge: y_min={y_min:.6f} < 0"
            )
        
        if y_max > 1:
            return LabelValidationError(
                filename, line_num, line,
                f"Bounding box exceeds bottom edge: y_max={y_max:.6f} > 1"
            )
        
        # All checks passed
        return None
        
    except Exception as e:
        return LabelValidationError(
            filename, line_num, line,
            f"Unexpected error: {str(e)}"
        )

def validate_label_file(filepath: Path) -> List[LabelValidationError]:
    """Validate a single label file."""
    errors = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Check if file is empty (YOLO allows empty label files)
        if not lines:
            return errors
        
        # Validate each line
        for line_num, line in enumerate(lines, start=1):
            error = validate_yolo_line(line, line_num, filepath.name)
            if error:
                errors.append(error)
    
    except UnicodeDecodeError:
        errors.append(LabelValidationError(
            filepath.name, 0, "",
            "File encoding error: not valid UTF-8"
        ))
    except Exception as e:
        errors.append(LabelValidationError(
            filepath.name, 0, "",
            f"File read error: {str(e)}"
        ))
    
    return errors

def scan_dataset(dataset_path: Path) -> Tuple[List[LabelValidationError], int, int]:
    """Scan all label files in labels/train and labels/val."""
    all_errors = []
    total_files = 0
    total_lines = 0
    
    # Check both train and val directories
    for split in ['train', 'val']:
        labels_dir = dataset_path / 'labels' / split
        
        if not labels_dir.exists():
            print(f"WARNING: Directory not found: {labels_dir}")
            continue
        
        print(f"\nScanning: {labels_dir}")
        
        # Find all .txt files
        txt_files = sorted(labels_dir.glob('*.txt'))
        
        if not txt_files:
            print(f"   No .txt files found in {split}/")
            continue
        
        print(f"   Found {len(txt_files)} label file(s)")
        
        for txt_file in txt_files:
            total_files += 1
            errors = validate_label_file(txt_file)
            
            if errors:
                all_errors.extend(errors)
            
            # Count lines for statistics
            try:
                with open(txt_file, 'r', encoding='utf-8') as f:
                    line_count = len([l for l in f if l.strip()])
                    total_lines += line_count
            except:
                pass
    
    return all_errors, total_files, total_lines

def main():
    dataset_path = Path(r"C:\Gsn Soln\VisionBackend\datasets\gsn\ConnectWell\v1")
    
    if not dataset_path.exists():
        print(f"ERROR: Dataset path does not exist: {dataset_path}")
        sys.exit(1)
    
    print("=" * 80)
    print("YOLO Label File Validator")
    print("=" * 80)
    print(f"Dataset: {dataset_path}")
    print()
    
    # Scan all label files
    errors, total_files, total_lines = scan_dataset(dataset_path)
    
    # Report results
    print("\n" + "=" * 80)
    print("VALIDATION RESULTS")
    print("=" * 80)
    print(f"Total label files scanned: {total_files}")
    print(f"Total annotation lines: {total_lines}")
    print(f"Total errors found: {len(errors)}")
    print()
    print("Validation checks performed:")
    print("  - Each line has exactly 5 values (class_id center_x center_y width height)")
    print("  - class_id is a non-negative integer")
    print("  - center_x, center_y, width, height are finite numbers (not NaN/Infinity)")
    print("  - width > 0 and height > 0 (no zero-width/height boxes)")
    print("  - center_x and center_y are within [0, 1]")
    print("  - Bounding boxes do not exceed image bounds")
    print("  - File encoding is valid UTF-8")
    print()
    
    if not errors:
        print("SUCCESS: ALL LABELS ARE VALID")
        print("\nAll label files passed validation according to Ultralytics YOLO requirements.")
        print("No corrupt or invalid annotations detected.")
    else:
        print("ERROR: CORRUPT LABELS DETECTED")
        print("\nThe following label files contain invalid annotations:\n")
        
        # Group errors by file
        errors_by_file = {}
        for error in errors:
            if error.filename not in errors_by_file:
                errors_by_file[error.filename] = []
            errors_by_file[error.filename].append(error)
        
        # Print errors
        for filename, file_errors in sorted(errors_by_file.items()):
            print(f"\nFile: {filename}:")
            for error in file_errors:
                if error.line_num > 0:
                    print(f"   Line {error.line_num}: '{error.line_content}'")
                print(f"   → {error.reason}")
        
        print("\n" + "=" * 80)
        print("IMPACT ANALYSIS")
        print("=" * 80)
        print("""
CRITICAL: Even ONE corrupt label can cause YOLO training to fail.

Ultralytics YOLO performs strict validation during dataset loading:
- Invalid labels cause "division by zero" or "index out of range" errors
- YOLO validates ALL labels before training starts
- A single corrupt label file can prevent the entire dataset from loading
- Training will fail immediately with validation errors

RECOMMENDATION:
1. Fix or remove all corrupt label files listed above
2. Re-run validation to confirm all labels are valid
3. Only then proceed with YOLO training

Common fixes:
- Remove lines with invalid coordinates
- Fix out-of-range values (clamp to [0, 1])
- Remove zero-width or zero-height boxes
- Fix malformed lines (ensure exactly 5 values)
        """)
    
    print("=" * 80)
    
    # Exit with error code if issues found
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()

