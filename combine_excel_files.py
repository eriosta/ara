#!/usr/bin/env python3
"""
Script to combine all Excel files in ./data/ into a single database Excel file.
"""

import pandas as pd
import os
from pathlib import Path

def combine_excel_files(data_dir='./data', output_file='./data/database.xlsx'):
    """
    Combine all Excel files in the data directory into a single database file.
    
    Args:
        data_dir: Directory containing Excel files
        output_file: Path to the output combined Excel file
    """
    data_path = Path(data_dir)
    output_filename = Path(output_file).name
    excel_files = sorted([f for f in data_path.glob('*.xlsx') if f.name != output_filename])
    
    if not excel_files:
        print(f"No Excel files found in {data_dir}")
        return
    
    print(f"Found {len(excel_files)} Excel files:")
    for f in excel_files:
        print(f"  - {f.name}")
    
    all_dataframes = []
    
    for excel_file in excel_files:
        print(f"\nProcessing {excel_file.name}...")
        try:
            # Read Excel file, skipping the first 8 rows (metadata) and using row 8 as header
            df = pd.read_excel(excel_file, header=8, engine='openpyxl')
            
            # Convert all column names to strings (in case some are datetime or other types)
            df.columns = df.columns.astype(str)
            
            # Remove unnamed columns
            df = df.loc[:, ~df.columns.str.contains('^Unnamed', na=False)]
            
            # Remove rows that are completely empty or have NaN in key columns
            # Keep rows that have at least DICTATION DTTM or EXAM DESC
            key_columns = ['DICTATION DTTM', 'EXAM DESC']
            if all(col in df.columns for col in key_columns):
                df = df.dropna(subset=key_columns, how='all')
            else:
                # If columns don't match expected format, try to clean empty rows
                df = df.dropna(how='all')
            
            if not df.empty:
                all_dataframes.append(df)
                print(f"  ✓ Loaded {len(df)} rows")
            else:
                print(f"  ⚠ No valid data rows found")
                
        except Exception as e:
            print(f"  ✗ Error reading {excel_file.name}: {str(e)}")
            continue
    
    if not all_dataframes:
        print("\nNo data to combine!")
        return
    
    # Combine all dataframes
    print(f"\nCombining {len(all_dataframes)} dataframes...")
    combined_df = pd.concat(all_dataframes, ignore_index=True)
    
    # Remove completely empty rows
    combined_df = combined_df.dropna(how='all')
    
    # Convert all column names to strings (in case some are datetime or other types)
    combined_df.columns = combined_df.columns.astype(str)
    
    # Remove any remaining unnamed columns (in case they were added during concat)
    combined_df = combined_df.loc[:, ~combined_df.columns.str.contains('^Unnamed', na=False)]
    
    # Sort by DICTATION DTTM if available
    if 'DICTATION DTTM' in combined_df.columns:
        try:
            combined_df['DICTATION DTTM'] = pd.to_datetime(combined_df['DICTATION DTTM'], errors='coerce')
            combined_df = combined_df.sort_values('DICTATION DTTM', na_position='last')
        except:
            pass
    
    # Save to Excel file
    output_path = Path(output_file)
    print(f"\nSaving combined data to {output_path}...")
    combined_df.to_excel(output_path, index=False, engine='openpyxl')
    
    print(f"\n✓ Successfully created database file!")
    print(f"  Total rows: {len(combined_df)}")
    print(f"  Total columns: {len(combined_df.columns)}")
    print(f"  Columns: {', '.join(combined_df.columns.tolist())}")
    print(f"\nDatabase saved to: {output_path.absolute()}")

if __name__ == '__main__':
    combine_excel_files()

